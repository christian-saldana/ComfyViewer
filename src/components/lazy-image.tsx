"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getStoredImageFile } from "@/lib/image-db";

interface LazyImageProps {
  imageId: number;
  setAllImageMetadata: any;
  allImageMetadata: any;
  alt: string;
  className: string;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  });
}

export function LazyImage({ imageId, setAllImageMetadata, allImageMetadata, alt, className }: LazyImageProps) {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const placeholderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let observer: IntersectionObserver;
    let objectUrl: string | null = null;

    const metadata = allImageMetadata.find(img => img.id === imageId);

    const currentRef = placeholderRef.current;
    if (currentRef) {
      observer = new IntersectionObserver(
        async ([entry]) => {
          if (entry.isIntersecting) {
            const file = await getStoredImageFile(imageId);
            if (file) {
              objectUrl = URL.createObjectURL(file);
              setImageSrc(objectUrl);

              const { width, height } = await getImageDimensions(file);

              const updatedMetadata = { ...metadata, width, height };
              setAllImageMetadata(prev =>
                prev.map(img => img.id === imageId ? updatedMetadata : img)
              );
            }
            observer.unobserve(currentRef);
          }
        },
        {
          // The root defaults to the browser viewport, which is what we want now.
          rootMargin: "200px",
        }
      );
      observer.observe(currentRef);
    }

    return () => {
      if (observer && currentRef) {
        observer.unobserve(currentRef);
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageId]);

  if (imageSrc) {
    return <img src={imageSrc} alt={alt} className={className} />;
  }

  return (
    <div ref={placeholderRef} className="h-full w-full">
      <Skeleton className="h-full w-full" />
    </div>
  );
}