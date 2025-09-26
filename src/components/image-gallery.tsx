"use client";

import * as React from "react";

import { ImageIcon } from "lucide-react";

import { ComfyViewerDialog } from "@/components/comfy-viewer-dialog";
import { GalleryPagination } from "@/components/gallery-pagination";
import { LazyImage } from "@/components/lazy-image";
import { StoredImage } from "@/lib/image-db";
import { cn } from "@/lib/utils";
import { ITEMS_PER_PAGE_OPTIONS } from "@/hooks/use-pagination"; // Import here

interface ImageGalleryProps {
  files: StoredImage[];
  allImageMetadata: StoredImage[];
  selectedImageId: number | null;
  onSelectImage: (id: number) => void;
  gridCols: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  itemsPerPageOptions: number[];
  totalImagesCount: number;
  folderPath: string; // New prop for the base folder path
}

export function ImageGallery({
  files,
  allImageMetadata,
  selectedImageId,
  onSelectImage,
  gridCols,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalImagesCount,
  folderPath, // Destructure new prop
}: ImageGalleryProps) {
  const [fullscreenImageSrc, setFullscreenImageSrc] = React.useState<string | null>(null);
  const [fullscreenImageAlt, setFullscreenImageAlt] = React.useState("");
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);

  const openViewer = async (image: StoredImage) => {
    if (!image?.fullPath) return
    // Construct the API URL for the full-screen image
    const imageUrl = `/api/image?path=${encodeURIComponent(image.fullPath)}`;
    setFullscreenImageSrc(imageUrl);
    setFullscreenImageAlt(image.name);
    setIsViewerOpen(true);
  };

  const handleDoubleClick = (image: StoredImage) => {
    onSelectImage(image.id);
    openViewer(image);
  };

  React.useEffect(() => {
    // When selectedImageId changes and viewer is open, update the fullscreen image
    if (isViewerOpen && selectedImageId !== null) {
      const image = allImageMetadata.find((f) => f.id === selectedImageId);
      if (image && image.fullPath) {
        const imageUrl = `/api/image?path=${encodeURIComponent(image.fullPath)}`;
        setFullscreenImageSrc(imageUrl);
        setFullscreenImageAlt(image.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImageId, isViewerOpen, allImageMetadata, folderPath]); // Add folderPath to dependencies

  React.useEffect(() => {
    // When viewer closes, clear the fullscreen image src
    if (!isViewerOpen && fullscreenImageSrc) {
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

  const isSingleColumn = gridCols === 1;

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex-grow overflow-auto p-4">
          <div className="mb-2 flex justify-start">
            <p className="text-sm text-muted-foreground">
              {totalImagesCount} {totalImagesCount === 1 ? "image" : "images"}
            </p>
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {files.map((image) => (
              <div
                key={image.id}
                className={cn(
                  "relative cursor-pointer overflow-hidden rounded-md border-4",
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
                  imagePath={image.fullPath || ''} // Pass imagePath
                  folderPath={folderPath} // Pass folderPath
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
        <GalleryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
          itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
        />
      </div>
      <ComfyViewerDialog
        src={fullscreenImageSrc}
        alt={fullscreenImageAlt}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
      />
    </>
  );
}