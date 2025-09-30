"use client";

import * as React from "react";

import { DialogDescription } from "@radix-ui/react-dialog";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ComfyViewerDialogProps {
  fileType: string;
  src: string | null;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComfyViewerDialog({
  fileType,
  src,
  alt,
  open,
  onOpenChange,
}: ComfyViewerDialogProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-auto max-w-[90vw] max-h-[90vh] items-center justify-center p-0 border-none bg-transparent">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">Full-screen view of the image: {alt}</DialogDescription>
        {src && fileType === "image" && (
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {src && fileType === "video" && (
          <video
            ref={videoRef}
            src={src}
            controls
            muted
            loop
            playsInline
            className="max-h-full max-w-full object-contain"
            onMouseEnter={() => videoRef.current?.play()}
            onMouseLeave={() => {
              if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0; // reset to start if you want
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}