"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { ImageViewerDialog } from "./image-viewer-dialog";
import { StoredImage } from "@/lib/image-db";
import { GalleryPagination } from "./gallery-pagination";
import { LazyImage } from "./lazy-image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollContainerContext } from "./scroll-container-context";

interface ImageGalleryProps {
  files: StoredImage[];
  selectedImage: File | null;
  onSelectImage: (file: File) => void;
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
  selectedImage,
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
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const handleDoubleClick = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setFullscreenImageSrc(objectUrl);
    setIsViewerOpen(true);
  };

  React.useEffect(() => {
    if (!isViewerOpen && fullscreenImageSrc) {
      URL.revokeObjectURL(fullscreenImageSrc);
      setFullscreenImageSrc(null);
    }
  }, [isViewerOpen, fullscreenImageSrc]);

  const rowCount = Math.ceil(files.length / gridCols);
  const columnCount = gridCols;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (parentRef.current ? parentRef.current.offsetWidth / columnCount : 250),
    overscan: 3,
  });

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
  const isSingleColumn = columnCount === 1;

  return (
    <div className="flex h-full flex-col">
      <ScrollContainerContext.Provider value={parentRef}>
        <div ref={parentRef} className="flex-grow overflow-auto">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const itemsInRow = files.slice(
                virtualRow.index * columnCount,
                (virtualRow.index * columnCount) + columnCount
              );
              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    gap: "1rem",
                    padding: "1rem",
                  }}
                >
                  {itemsInRow.map(({ file }) => (
                    <div
                      key={file.name + file.webkitRelativePath}
                      className={cn(
                        "relative cursor-pointer overflow-hidden border-2",
                        selectedImage?.name === file.name &&
                          selectedImage.webkitRelativePath === file.webkitRelativePath
                          ? "border-primary"
                          : "border-transparent",
                        !isSingleColumn && "aspect-square"
                      )}
                      onClick={() => onSelectImage(file)}
                      onDoubleClick={() => handleDoubleClick(file)}
                    >
                      <LazyImage
                        file={file}
                        alt={file.name}
                        className={cn(
                          "h-full w-full",
                          isSingleColumn ? "object-contain" : "object-cover"
                        )}
                      />
                      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="truncate text-xs font-medium text-white">
                          {file.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollContainerContext.Provider>
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
      <ImageViewerDialog
        src={fullscreenImageSrc}
        alt={selectedImage?.name || "Fullscreen Image"}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
      />
    </div>
  );
}