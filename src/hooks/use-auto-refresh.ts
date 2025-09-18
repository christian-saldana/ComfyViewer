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
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if ((await handle.requestPermission(options)) === "granted") {
    return true;
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

export function useAutoRefresh(
  onNewFiles: (files: File[], isInitialScan: boolean) => Promise<void>
) {
  const [directoryHandle, setDirectoryHandle] =
    React.useState<FileSystemDirectoryHandle | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const lastScanTimeRef = React.useRef<number>(0);

  // Load handle from DB on mount
  React.useEffect(() => {
    if (!isFileSystemAccessAPISupported()) return;
    const loadHandle = async () => {
      const handle = await getDirectoryHandle();
      if (handle) {
        if (await verifyPermission(handle)) {
          setDirectoryHandle(handle);
        } else {
          console.warn("Permission for stored directory handle was denied.");
        }
      }
    };
    loadHandle();
  }, []);

  const requestAndSetDirectory = async () => {
    if (!isFileSystemAccessAPISupported()) {
      toast.error("Your browser does not support this feature.");
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker();
      await storeDirectoryHandle(handle);
      setDirectoryHandle(handle);
      return handle;
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
        lastScanTimeRef.current = Date.now();
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
      lastScanTimeRef.current = 0; // Reset to scan all files
      scanForChanges(true);
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