"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ScrollContainerContext } from "./scroll-container-context";

interface LazyImageProps {
  file: File;
  alt: string;
  className: string;
}

export function LazyImage({ file, alt, className }: LazyImageProps) {
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const placeholderRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useContext(ScrollContainerContext);

  React.useEffect(() => {
    let observer: IntersectionObserver;
    let objectUrl: string | null = null;

    const currentRef = placeholderRef.current;
    if (currentRef) {
      const scrollParent = scrollContainerRef?.current ?? null;

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            objectUrl = URL.createObjectURL(file);
            setImageSrc(objectUrl);
            observer.unobserve(currentRef);
          }
        },
        {
          root: scrollParent,
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
  }, [file, scrollContainerRef]);

  if (imageSrc) {
    return <img src={imageSrc} alt={alt} className={className} />;
  }

  return (
    <div ref={placeholderRef} className="h-full w-full">
      <Skeleton className="h-full w-full" />
    </div>
  );
}