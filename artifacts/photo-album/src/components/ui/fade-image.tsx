import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { requestSlot, type SlotHandle } from "@/lib/imageQueue";

interface FadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export function FadeImage({ src, alt, className, onLoad, ...props }: FadeImageProps) {
  const [activeSrc, setActiveSrc] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const slotRef = useRef<SlotHandle | null>(null);

  useEffect(() => {
    setLoaded(false);
    setActiveSrc(undefined);

    const slot = requestSlot(() => setActiveSrc(src));
    slotRef.current = slot;

    return () => {
      slot.cancel();
      slotRef.current = null;
    };
  }, [src]);

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
        onLoad={(e) => {
          setLoaded(true);
          slotRef.current?.complete();
          onLoad?.(e);
        }}
        onError={() => {
          setLoaded(true);
          slotRef.current?.complete();
        }}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
        {...props}
      />
    </div>
  );
}
