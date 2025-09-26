"use client";

import * as React from "react";

import { StoredImage } from "@/lib/image-db";

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
  }, [selectedImageId, allImageMetadata, setAllImageMetadata]);

  return {
    selectedImageId,
    setSelectedImageId,
    selectedImageFile,
    selectedImageMetadata,
  };
}