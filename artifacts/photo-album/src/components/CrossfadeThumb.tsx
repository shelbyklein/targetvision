import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CYCLE_MS = 4000;

/**
 * Card thumbnail that slowly crossfades through a handful of photos. The cycle
 * start is staggered randomly per card so a grid of them doesn't blink in
 * unison, and prefers-reduced-motion pins it to the first image.
 */
export function CrossfadeThumb({ urls, alt, className }: { urls: string[]; alt: string; className?: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (urls.length < 2) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let interval: number | undefined;
    const stagger = window.setTimeout(() => {
      interval = window.setInterval(() => setIdx((i) => (i + 1) % urls.length), CYCLE_MS);
      setIdx((i) => (i + 1) % urls.length);
    }, Math.random() * CYCLE_MS);
    return () => {
      window.clearTimeout(stagger);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [urls.length]);

  if (urls.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground/40", className)}>
        <Sparkles className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {urls.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={i === 0 ? alt : ""}
          loading="lazy"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
            i === idx % urls.length ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}
