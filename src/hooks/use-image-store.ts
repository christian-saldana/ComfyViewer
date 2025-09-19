"use client";

import * as React from "react";

import { toast } from "sonner";

import { buildFileTree } from "@/lib/file-tree";
import {
  addNewImages,
  clearAllData,
  getAllStoredImageMetadata,
  StoredImage,
  storeImages,
} from "@/lib/image-db";

export function useImageStore() {
  const [allImageMetadata, setAllImageMetadata] = React.useState<StoredImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [isRefreshMode, setIsRefreshMode] = React.useState(false);
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
        } else {
          toast.warning(`No new images added.`);
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
    await handleNewFiles(imageFiles, !isRefreshMode); // Treat manual selection as an initial scan
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (isRefreshMode) setIsRefreshMode(false)
    return { isRefresh: false, newTree: buildFileTree(await getAllStoredImageMetadata()) };
  };

  const handleClearAllData = async () => {
    await clearAllData();
    setAllImageMetadata([]);
    toast.success("Image library cleared.");
  };

  return {
    handleNewFiles,
    allImageMetadata,
    setAllImageMetadata,
    isLoading: isLoading,
    progress,
    fileTree,
    fileInputRef,
    handleFileSelect,
    handleClearAllData,
    setIsRefreshMode
  };
}