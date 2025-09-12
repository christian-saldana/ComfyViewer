"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";

interface MetadataViewerProps {
  image: File | null;
}

export function MetadataViewer({ image }: MetadataViewerProps) {
  if (!image) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <Info className="h-12 w-12" />
        <h2 className="mt-4 text-lg font-semibold">No Image Selected</h2>
        <p className="mt-1 text-sm">Select an image to view its details.</p>
      </div>
    );
  }

  const metadata = [
    { label: "File Name", value: image.name },
    { label: "File Size", value: `${(image.size / 1024).toFixed(2)} KB` },
    { label: "File Type", value: image.type },
    {
      label: "Last Modified",
      value: new Date(image.lastModified).toLocaleString(),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b p-4 text-lg font-semibold">Metadata</h2>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <ul className="space-y-3">
            {metadata.map((item, index) => (
              <li key={index}>
                <p className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="break-words text-sm">{item.value}</p>
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  );
}