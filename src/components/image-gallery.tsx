"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { ImageViewerDialog } from "./image-viewer-dialog";

interface ImageGalleryProps {
  files: File[];
  selectedImage: File | null;
  onSelectImage: (file: File) => void;
  gridCols: number;
}

export function ImageGallery({
  files,
  selectedImage,
  onSelectImage,
  gridCols,
}: ImageGalleryProps) {
  const [imageSrcs, setImageSrcs] = React.useState<Map<string, string>>(new Map());
  const [fullscreenImageSrc, setFullscreenImageSrc] = React.useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = React.useState(false);

  React.useEffect(() => {
    const newImageSrcs = new Map<string, string>();
    const objectUrlsToRevoke: string[] = [];

    files.forEach((file) => {
      // The File object from local storage won't have a dataURL property.
      // We create an object URL for all files to display them.
      const url = URL.createObjectURL(file);
      newImageSrcs.set(file.name, url);
      objectUrlsToRevoke.push(url);
    });

    setImageSrcs(newImageSrcs);

    // Cleanup object URLs on unmount or when files change
    return () => {
      objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const handleDoubleClick = (file: File) => {
    const src = imageSrcs.get(file.name);
    if (src) {
      setFullscreenImageSrc(src);
      setIsViewerOpen(true);
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
        <ImageIcon className="h-16 w-16" />
        <h2 className="mt-4 text-lg font-semibold">No Images Selected</h2>
        <p className="mt-1 text-sm">
          Click the &quot;Select Folder&quot; button to get started.
        </p>
      </div>
    );
  }

  const isSingleColumn = gridCols === 1;

  return (
    <>
      <ScrollArea className="h-full">
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
        >
          {files.map((file) => (
            <div
              key={file.name}
              className={cn(
                "relative cursor-pointer overflow-hidden border-2",
                selectedImage?.name === file.name
                  ? "border-primary"
                  : "border-transparent",
                !isSingleColumn && "aspect-square"
              )}
              onClick={() => onSelectImage(file)}
              onDoubleClick={() => handleDoubleClick(file)}
            >
              <img
                src={imageSrcs.get(file.name)}
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
      </ScrollArea>

      <ImageViewerDialog
        src={fullscreenImageSrc}
        alt={selectedImage?.name || "Fullscreen Image"}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
      />
    </>
  );
}