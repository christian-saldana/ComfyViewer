"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { ImageViewerDialog } from "./image-viewer-dialog";
import { StoredImage, getStoredImageFile } from "@/lib/image-db";
import { GalleryPagination } from "./gallery-pagination";
import { LazyImage } from "./lazy-image";

interface ImageGalleryProps {
  files: StoredImage[];
  selectedImageId: number | null;
  onSelectImage: (id: number) => void;
  gridCols: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  itemsPerPageOptions: number[];
}

export function ImageGallery({
  files,
  selectedImageId,
  onSelectImage,
  gridCols,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  itemsPerPageOptions,
}: ImageGalleryProps) {
  const [fullscreenImageSrc, setFullscreenImageSrc] = React.useState<string | null>(null);
  const [fullscreenImageAlt, setFullscreenImageAlt] = React.useState("");
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);

  const handleDoubleClick = async (image: StoredImage) => {
    const file = await getStoredImageFile(image.id);
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setFullscreenImageSrc(objectUrl);
      setFullscreenImageAlt(image.name);
      setIsViewerOpen(true);
    }
  };

  React.useEffect(() => {
    if (!isViewerOpen && fullscreenImageSrc) {
      URL.revokeObjectURL(fullscreenImageSrc);
      setFullscreenImageSrc(null);
      setFullscreenImageAlt("");
    }
  }, [isViewerOpen, fullscreenImageSrc]);

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <ImageIcon className="h-16 w-16" />
        <h2 className="mt-4 text-lg font-semibold">No Images to Display</h2>
        <p className="mt-1 text-sm">
          Select a folder with images or adjust your filters.
        </p>
      </div>
    );
  }

  const showPagination = totalPages > 1;
  const isSingleColumn = gridCols === 1;

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex-grow overflow-auto p-4">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {files.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "relative cursor-pointer overflow-hidden rounded-md border-2",
                  selectedImageId === image.id
                    ? "border-primary"
                    : "border-transparent",
                  !isSingleColumn && "aspect-square"
                )}
                onClick={() => onSelectImage(image.id)}
                onDoubleClick={() => handleDoubleClick(image)}
              >
                <LazyImage
                  imageId={image.id}
                  alt={image.name}
                  className={cn(
                    "h-full w-full",
                    isSingleColumn ? "object-contain" : "object-cover"
                  )}
                />
                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="truncate text-xs font-medium text-white">
                    {image.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {showPagination && (
          <GalleryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={onItemsPerPageChange}
            itemsPerPageOptions={itemsPerPageOptions}
          />
        )}
      </div>
      <ImageViewerDialog
        src={fullscreenImageSrc}
        alt={fullscreenImageAlt}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
      />
    </>
  );
}