"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";

interface LazyImageProps {
  imageId: number;
  imagePath: string; // The webkitRelativePath of the image
  folderPath: string; // The absolute base folder path
  alt: string;
  className: string;
}

export function LazyImage({ imageId, imagePath, folderPath, alt, className }: LazyImageProps) {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const placeholderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let observer: IntersectionObserver;

    const currentRef = placeholderRef.current;
    if (currentRef) {
      observer = new IntersectionObserver(
        async ([entry]) => {
          if (entry.isIntersecting) {
            // Fetch image from the new API route
            const imageUrl = `/api/image?path=${encodeURIComponent(imagePath)}`;
            setImageSrc(imageUrl);
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

  if (imageSrc) {
    return <img src={imageSrc} alt={alt} className={className} />;
  }

  return (
    <div ref={placeholderRef} className="h-full w-full">
      <Skeleton className="h-full w-full" />
    </div>
  );
}