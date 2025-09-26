"use client";

import * as React from "react";

import { toast } from "sonner";

import { buildFileTree } from "@/lib/file-tree";
import {
  clearAllData,
  getAllStoredImageMetadata,
  StoredImage,
} from "@/lib/image-db";

export function useImageStore() {
  const [allImageMetadata, setAllImageMetadata] = React.useState<StoredImage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [progress, setProgress] = React.useState(0);

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

  const handleClearAllData = async () => {
    await clearAllData();
    setAllImageMetadata([]);
    toast.success("Image library cleared.");
  };

  return {
    allImageMetadata,
    setAllImageMetadata,
    isLoading: isLoading,
    progress,
    fileTree,
    handleClearAllData,
    setIsLoading,
    setProgress
  };
}