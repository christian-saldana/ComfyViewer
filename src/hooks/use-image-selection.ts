"use client";

import * as React from "react";
import { StoredImage, getStoredImageFile } from "@/lib/image-db";

export function useImageSelection(allImageMetadata: StoredImage[]) {
  const [selectedImageId, setSelectedImageId] = React.useState<number | null>(null);
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
  const [selectedImageMetadata, setSelectedImageMetadata] = React.useState<StoredImage | null>(null);

  React.useEffect(() => {
    if (selectedImageId === null) {
      setSelectedImageFile(null);
      setSelectedImageMetadata(null);
      return;
    }

    const metadata = allImageMetadata.find(img => img.id === selectedImageId);
    setSelectedImageMetadata(metadata || null);

    let isCancelled = false;
    async function fetchFile() {
      const file = await getStoredImageFile(selectedImageId!);
      if (!isCancelled) {
        setSelectedImageFile(file);
      }
    }
    fetchFile();
    return () => { isCancelled = true; };
  }, [selectedImageId, allImageMetadata]);

  return {
    selectedImageId,
    setSelectedImageId,
    selectedImageFile,
    selectedImageMetadata,
  };
}