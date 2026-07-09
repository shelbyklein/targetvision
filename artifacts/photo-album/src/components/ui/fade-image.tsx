import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { requestSlot, type SlotHandle } from "@/lib/imageQueue";

interface FadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /**
   * "cover" (default): image absolutely fills a wrapper that gets its size
   * from the caller (e.g. an aspect-ratio grid cell).
   * "contain": image is laid out normally so it sizes itself intrinsically
   * (e.g. a lightbox where the wrapper has no fixed dimensions of its own).
   */
  fit?: "cover" | "contain";
}

export function FadeImage({ src, alt, className, onLoad, onError, fit = "cover", ...props }: FadeImageProps) {
  const [activeSrc, setActiveSrc] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const slotRef = useRef<SlotHandle | null>(null);
  // Lazy images must not hold a queue slot: the browser defers their fetch
  // until near-viewport, so onLoad/onError may never fire and the slot would
  // be pinned forever, starving eager images (e.g. the lightbox). Native
  // loading="lazy" already throttles them, so they skip the queue.
  const isLazy = props.loading === "lazy";

  useEffect(() => {
    setLoaded(false);

    if (isLazy) {
      setActiveSrc(src);
      return;
    }

    setActiveSrc(undefined);
    const slot = requestSlot(() => setActiveSrc(src));
    slotRef.current = slot;

    return () => {
      slot.cancel();
      slotRef.current = null;
    };
  }, [src, isLazy]);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    setLoaded(true);
    slotRef.current?.complete();
    onLoad?.(e);
  }

  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    setLoaded(true);
    slotRef.current?.complete();
    onError?.(e);
  }

  if (fit === "contain") {
    return (
      <img
        src={activeSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn("transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
        {...props}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className={cn(
          "absolute inset-0 animate-shimmer transition-opacity duration-300",
          loaded ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      />
      <img
        src={activeSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
        {...props}
      />
    </div>
  );
}
