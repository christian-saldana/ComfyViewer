"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";

interface LazyImageProps {
  fileType: string;
  imageId: number;
  imagePath: string; // The webkitRelativePath of the image
  folderPath: string; // The absolute base folder path
  alt: string;
  className: string;
}

export function LazyImage({ fileType, imageId, imagePath, folderPath, alt, className }: LazyImageProps) {
  const [mediaSrc, setMediaSrc] = React.useState<string | null>(null);
  const placeholderRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    let observer: IntersectionObserver;

    const currentRef = placeholderRef.current;
    if (currentRef) {
      observer = new IntersectionObserver(
        async ([entry]) => {
          if (entry.isIntersecting) {
            // Fetch image from the new API route
            const imageUrl = `/api/image?path=${encodeURIComponent(imagePath)}`;
            setMediaSrc(imageUrl);
            observer.unobserve(currentRef);
          }
        },
        {
          rootMargin: "300px",
        }
      );
      observer.observe(currentRef);
    }

    return () => {
      if (observer && currentRef) {
        observer.unobserve(currentRef);
      }
      // No need to revokeObjectURL if we're directly using the API URL
    };
  }, [imageId, imagePath, folderPath]);

  if (fileType?.startsWith("image") && mediaSrc) {
    return <img src={mediaSrc} alt={alt} className={className} />;
  } else if (mediaSrc) {
    return (
      <video
        ref={videoRef}
        src={mediaSrc}
        muted
        loop
        playsInline
        className={className}
        onMouseEnter={() => videoRef.current?.play()}
        onMouseLeave={() => {
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0; // reset to start if you want
          }
        }}
      />
    );
  }

  return (
    <div ref={placeholderRef} className="h-full w-full">
      <Skeleton className="h-full w-full" />
    </div>
  );
}