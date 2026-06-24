import { useState } from "react";
import { cn } from "@/lib/utils";

interface FadeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export function FadeImage({ src, alt, className, onLoad, ...props }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        "transition-opacity duration-500",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
      {...props}
    />
  );
}
