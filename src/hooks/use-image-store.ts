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

export function useImageStore() {
  const [allImageMetadata, setAllImageMetadata] = React.useState<StoredImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [isRefreshMode, setIsRefreshMode] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    setIsLoading(true);
    setProgress(0);

    if (isRefreshMode) {
      const newImageCount = await addNewImages(imageFiles, setProgress);
      toast.success(newImageCount > 0 ? `${newImageCount} new image(s) added.` : "No new images found.");
      setIsRefreshMode(false);
    } else {
      await storeImages(imageFiles, setProgress);
      toast.success("Image library loaded.");
    }

    const metadata = await getAllStoredImageMetadata();
    setAllImageMetadata(metadata);
    setIsLoading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    return { isRefresh: isRefreshMode, newTree: buildFileTree(metadata) };
  };

  const handleClearImages = async () => {
    await clearImages();
    setAllImageMetadata([]);
    toast.success("Image library cleared.");
  };

  const handleFolderSelectClick = () => {
    setIsRefreshMode(false);
    fileInputRef.current?.click();
  };

  const handleRefreshClick = () => {
    setIsRefreshMode(true);
    fileInputRef.current?.click();
  };

  return {
    allImageMetadata,
    setAllImageMetadata,
    isLoading,
    progress,
    fileTree,
    fileInputRef,
    handleFileSelect,
    handleClearImages,
    handleFolderSelectClick,
    handleRefreshClick,
  };
}