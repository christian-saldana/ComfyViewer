"use client";

import * as React from "react";

import { toast } from "sonner";

import { getDirectoryHandle, storeDirectoryHandle } from "@/lib/image-db";

// Type guard to check for File System Access API support
export const isFileSystemAccessAPISupported = () =>
  "showDirectoryPicker" in window &&
  "requestPermission" in FileSystemHandle.prototype &&
  "queryPermission" in FileSystemHandle.prototype;

async function verifyPermission(handle: FileSystemDirectoryHandle) {
  const options = { mode: "read" as const };

  if (handle.queryPermission && handle.requestPermission) {
    if ((await handle.queryPermission(options)) === "granted") {
      return true;
    }
    if ((await handle.requestPermission(options)) === "granted") {
      return true;
    }
  }

  return false;
}

async function getFilesRecursively(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<File[]> {
  const files: File[] = [];
  for await (const entry of dirHandle.values()) {
    const newPath = `${path}/${entry.name}`;
    if (entry.kind === "file" && entry.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
      const file = await entry.getFile();
      Object.defineProperty(file, "webkitRelativePath", {
        value: newPath,
        writable: false,
        configurable: true,
      });
      files.push(file);
    } else if (entry.kind === "directory") {
      files.push(...(await getFilesRecursively(entry, newPath)));
    }
  }
  return files;
}

async function getFilesFromDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<File[]> {
  return getFilesRecursively(dirHandle, dirHandle.name);
}

const LAST_SCAN_TIME_KEY = "comfy-viewer-last-scan-time";

export function useAutoRefresh(
  onNewFiles: (files: File[], isInitialScan: boolean) => Promise<void>
) {
  const [directoryHandle, setDirectoryHandle] =
    React.useState<FileSystemDirectoryHandle | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const lastScanTimeRef = React.useRef<number>(0);

  // Load handle and last scan time from storage on mount
  React.useEffect(() => {
    if (!isFileSystemAccessAPISupported()) return;

    const loadInitialState = async () => {
      const storedTime = localStorage.getItem(LAST_SCAN_TIME_KEY);
      if (storedTime) {
        lastScanTimeRef.current = parseInt(storedTime, 10);
      }

      const handle = await getDirectoryHandle();
      if (handle) {
        if (await verifyPermission(handle)) {
          setDirectoryHandle(handle);
        } else {
          console.warn("Permission for stored directory handle was denied.");
        }
      }
    };
    loadInitialState();
  }, []);

  const requestAndSetDirectory = async () => {
    try {
      if (window.showDirectoryPicker) {
        const handle = await window.showDirectoryPicker();
        await storeDirectoryHandle(handle);
        setDirectoryHandle(handle);
        // This is a new directory selection, so reset the scan time to ensure a full scan.
        lastScanTimeRef.current = 0;
        localStorage.removeItem(LAST_SCAN_TIME_KEY);
        return handle;
      } else {
        toast.error("Your browser does not support this feature.");
        return null;
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Error selecting directory:", err);
        toast.error("Failed to select directory.");
      }
      return null;
    }
  };

  const scanForChanges = React.useCallback(
    async (isInitialScan = false) => {
      if (!directoryHandle || isScanning) return;

      setIsScanning(true);
      try {
        if (!(await verifyPermission(directoryHandle))) {
          toast.error("Permission denied to access the folder.");
          setDirectoryHandle(null); // Invalidate handle if permission is lost
          return;
        }

        const allFiles = await getFilesFromDirectory(directoryHandle);
        const newFiles = allFiles.filter(
          (file) => file.lastModified > lastScanTimeRef.current
        );

        if (newFiles.length > 0) {
          await onNewFiles(newFiles, isInitialScan);
        } else if (!isInitialScan) {
          toast.info("No new images found.");
        }

        // Persist the new scan time after a successful scan
        const now = Date.now();
        lastScanTimeRef.current = now;
        localStorage.setItem(LAST_SCAN_TIME_KEY, String(now));

      } catch (error) {
        console.error("Error scanning for changes:", error);
        toast.error("An error occurred while scanning for new images.");
      } finally {
        setIsScanning(false);
      }
    },
    [directoryHandle, isScanning, onNewFiles]
  );

  // Initial scan when a directory handle is first set
  React.useEffect(() => {
    if (directoryHandle) {
      // If lastScanTime is 0, it's a fresh folder, so treat it as an initial scan.
      // Otherwise, it's a refresh, so don't treat it as an initial scan.
      scanForChanges(lastScanTimeRef.current === 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryHandle]);

  // Set up polling
  React.useEffect(() => {
    if (!directoryHandle) return;

    const intervalId = setInterval(() => {
      scanForChanges(false);
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(intervalId);
  }, [directoryHandle, scanForChanges]);

  return {
    directoryHandle,
    requestAndSetDirectory,
    scanForChanges,
    isScanning,
  };
}