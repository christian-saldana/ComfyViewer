"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

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
      <DialogContent className="flex w-auto max-w-[90vw] max-h-[90vh] items-center justify-center p-0 border-none bg-transparent">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {src && (
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
        )}
        <DialogClose className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors">
          <X className="h-6 w-6" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}