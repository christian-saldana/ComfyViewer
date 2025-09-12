"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Image from "next/image";

interface ImageViewerDialogProps {
  src: string | null;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewerDialog({
  src,
  alt,
  open,
  onOpenChange,
}: ImageViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-full w-full max-w-full items-center justify-center p-0">
        {src && (
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}