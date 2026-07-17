import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const HOVER_CYCLE_MS = 1600;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Card thumbnail over a handful of photos. Loads showing one random image and
 * stays static; hovering plays a crossfade cycle through the rest (stopping on
 * whatever image is current when the pointer leaves). prefers-reduced-motion
 * keeps it fully static.
 */
export function CrossfadeThumb({ urls, alt, className }: { urls: string[]; alt: string; className?: string }) {
  const [idx, setIdx] = useState(() => (urls.length > 0 ? Math.floor(Math.random() * urls.length) : 0));
  const intervalRef = useRef<number | undefined>(undefined);

  function startCycle() {
    if (urls.length < 2 || prefersReducedMotion() || intervalRef.current !== undefined) return;
    setIdx((i) => (i + 1) % urls.length);
    intervalRef.current = window.setInterval(() => setIdx((i) => (i + 1) % urls.length), HOVER_CYCLE_MS);
  }

  function stopCycle() {
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }

  useEffect(() => stopCycle, []);

  if (urls.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground/40", className)}>
        <Sparkles className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      onMouseEnter={startCycle}
      onMouseLeave={stopCycle}
    >
      {urls.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={i === 0 ? alt : ""}
          loading="lazy"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            i === idx % urls.length ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}
