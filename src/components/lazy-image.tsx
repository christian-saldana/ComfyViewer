"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  file: File;
  alt: string;
  className: string;
}

export function LazyImage({ file, alt, className }: LazyImageProps) {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const placeholderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let observer: IntersectionObserver;
    let objectUrl: string | null = null;

    const currentRef = placeholderRef.current;
    if (currentRef) {
      // Find the parent ScrollArea viewport to use as the root for the observer.
      // This ensures that images are loaded only when they scroll into the gallery's view,
      // not just the main browser window's view.
      const scrollParent = currentRef.closest('[data-radix-scroll-area-viewport]');

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            objectUrl = URL.createObjectURL(file);
            setImageSrc(objectUrl);
            observer.unobserve(currentRef);
          }
        },
        {
          // Use the found scroll parent as the root, or default to the browser viewport.
          root: scrollParent,
          // Start loading images when they are 200px away from the viewport.
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
        // Revoke the object URL when the component unmounts to free up memory.
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  if (imageSrc) {
    return <img src={imageSrc} alt={alt} className={className} />;
  }

  // While the image is not loaded, show a skeleton placeholder.
  // The ref is attached here to trigger loading when it becomes visible.
  return (
    <div ref={placeholderRef} className="h-full w-full">
      <Skeleton className="h-full w-full" />
    </div>
  );
}