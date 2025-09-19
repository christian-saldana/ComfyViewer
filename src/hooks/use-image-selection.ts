"use client";

import * as React from "react";

import { getStoredImageFile, StoredImage, updateImageDimensions } from "@/lib/image-db";

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

export function useImageSelection(allImageMetadata: StoredImage[], setAllImageMetadata: React.Dispatch<React.SetStateAction<StoredImage[]>>) {
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
    async function fetchFileAndDimensions() {
      const file = await getStoredImageFile(selectedImageId!);
      if (isCancelled || !file) return;

      setSelectedImageFile(file);

      if (metadata && (metadata.width === null || metadata.height === null)) {
        const { width, height } = await getImageDimensions(file);
        if (!isCancelled) {
          await updateImageDimensions(selectedImageId!, width, height);

          // Update the local state to reflect the new dimensions immediately
          const updatedMetadata = { ...metadata, width, height };
          setSelectedImageMetadata(updatedMetadata);

          // Also update the master list of metadata
          setAllImageMetadata(prev =>
            prev.map(img => img.id === selectedImageId ? updatedMetadata : img)
          );
        }
      }
    }
    fetchFileAndDimensions();
    return () => { isCancelled = true; };
  }, [selectedImageId, allImageMetadata, setAllImageMetadata]);

  return {
    selectedImageId,
    setSelectedImageId,
    selectedImageFile,
    selectedImageMetadata,
  };
}