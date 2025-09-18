"use client";

import * as React from "react";

import { toast } from "sonner";

import { buildFileTree } from "@/lib/file-tree";
import {
  addNewImages,
  clearImages,
  getAllStoredImageMetadata,
  StoredImage,
  storeImages,
} from "@/lib/image-db";

import { isFileSystemAccessAPISupported, useAutoRefresh } from "./use-auto-refresh";

export function useImageStore() {
  const [allImageMetadata, setAllImageMetadata] = React.useState<StoredImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleNewFiles = async (files: File[], isInitialScan: boolean) => {
    setIsLoading(true);
    setProgress(0);
    try {
      if (isInitialScan) {
        await storeImages(files, setProgress);
        toast.success("Image library loaded.");
      } else {
        const newImageCount = await addNewImages(files, setProgress);
        if (newImageCount > 0) {
          toast.success(`${newImageCount} new image(s) added.`);
        }
      }
      const metadata = await getAllStoredImageMetadata();
      setAllImageMetadata(metadata);
    } catch (error) {
      console.error("Error processing new files:", error);
      toast.error((error as Error).message || "Failed to process new files.");
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  const { directoryHandle, requestAndSetDirectory, scanForChanges, isScanning } =
    useAutoRefresh(handleNewFiles);

  React.useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      const metadata = await getAllStoredImageMetadata();
      setAllImageMetadata(metadata);
      setIsLoading(false);
    }
    loadInitialData();
  }, []);

  const fileTree = React.useMemo(() => buildFileTree(allImageMetadata), [allImageMetadata]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const selectedFiles = Array.from(event.target.files);
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    await handleNewFiles(imageFiles, true); // Treat manual selection as an initial scan
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return { isRefresh: false, newTree: buildFileTree(await getAllStoredImageMetadata()) };
  };

  const handleClearImages = async () => {
    await clearImages();
    setAllImageMetadata([]);
    // This will also clear the directory handle in the DB,
    // but we might need to update the state in useAutoRefresh hook.
    // For now, a page reload would be required to reset the handle state.
    // A better solution would be to have a function to reset the handle state.
    window.location.reload(); // Simple solution for now
    toast.success("Image library cleared.");
  };

  const handleFolderSelectClick = async () => {
    if (isFileSystemAccessAPISupported()) {
      await requestAndSetDirectory();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleRefreshClick = () => {
    if (directoryHandle) {
      scanForChanges(false);
    } else {
      // Fallback for non-FSA API browsers or if no folder is selected
      fileInputRef.current?.click();
    }
  };

  return {
    allImageMetadata,
    setAllImageMetadata,
    isLoading: isLoading || isScanning,
    progress,
    fileTree,
    fileInputRef,
    handleFileSelect,
    handleClearImages,
    handleFolderSelectClick,
    handleRefreshClick,
    hasModernAccess: !!directoryHandle,
  };
}