"use client";

import * as React from "react";
import { StoredImage } from "@/lib/image-db";

interface KeyboardNavigationProps {
  selectedImageId: number | null;
  setSelectedImageId: (id: number) => void;
  processedImages: StoredImage[];
  gridCols: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
}

export function useKeyboardNavigation({
  selectedImageId,
  setSelectedImageId,
  processedImages,
  gridCols,
  currentPage,
  setCurrentPage,
  itemsPerPage,
}: KeyboardNavigationProps) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      
      event.preventDefault();
      if (selectedImageId === null || processedImages.length === 0) return;

      const currentIndex = processedImages.findIndex(img => img.id === selectedImageId);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = Math.min(currentIndex + 1, processedImages.length - 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(currentIndex + gridCols, processedImages.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(currentIndex - gridCols, 0);
          break;
      }

      if (nextIndex !== currentIndex) {
        const nextImage = processedImages[nextIndex];
        setSelectedImageId(nextImage.id);

        const newImagePage = Math.floor(nextIndex / itemsPerPage) + 1;
        if (newImagePage !== currentPage) {
          setCurrentPage(newImagePage);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, processedImages, gridCols, itemsPerPage, currentPage, setSelectedImageId, setCurrentPage]);
}