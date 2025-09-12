"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

interface ImageGalleryProps {
  files: File[];
  selectedImage: File | null;
  onSelectImage: (file: File) => void;
}

export function ImageGallery({
  files,
  selectedImage,
  onSelectImage,
}: ImageGalleryProps) {
  const [imageUrls, setImageUrls] = React.useState<Map<string, string>>(
    new Map()
  );

  React.useEffect(() => {
    const newImageUrls = new Map<string, string>();
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      newImageUrls.set(file.name, url);
    });
    setImageUrls(newImageUrls);

    // Cleanup object URLs on unmount
    return () => {
      newImageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

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

  return (
    <ScrollArea className="h-full">
      <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {files.map((file) => (
          <div
            key={file.name}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-lg border-2",
              selectedImage?.name === file.name
                ? "border-primary"
                : "border-transparent hover:border-primary/50"
            )}
            onClick={() => onSelectImage(file)}
          >
            <img
              src={imageUrls.get(file.name)}
              alt={file.name}
              className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
  );
}