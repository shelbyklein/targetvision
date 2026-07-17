import { useCallback, useEffect, useState } from "react";

export const MIN_GRID_ZOOM = 3;
export const MAX_GRID_ZOOM = 8;
const STORAGE_KEY = "photo_grid_zoom";

// First-visit default from this device's width: phones get fewer columns,
// wide screens more. Persisted after that, so each browser keeps its own.
function defaultZoom(): number {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1536) return 6;
  if (w >= 1024) return 5;
  if (w >= 640) return 4;
  return 3;
}

function clamp(n: number): number {
  return Math.min(MAX_GRID_ZOOM, Math.max(MIN_GRID_ZOOM, n));
}

/**
 * Photo-grid column count (3–8), stored per browser. Shared key across every
 * grid so the choice follows the user between pages on the same device.
 */
export function useGridZoom(): { zoom: number; setZoom: (n: number) => void } {
  const [zoom, setZoomState] = useState<number>(() => {
    if (typeof localStorage === "undefined") return defaultZoom();
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(raw) && raw >= MIN_GRID_ZOOM && raw <= MAX_GRID_ZOOM ? raw : defaultZoom();
  });

  const setZoom = useCallback((n: number) => {
    const next = clamp(Math.round(n));
    setZoomState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable (private mode) — zoom just won't persist.
    }
  }, []);

  // Keep grids on other pages/tabs in sync when the value changes.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const n = Number(e.newValue);
        if (Number.isInteger(n) && n >= MIN_GRID_ZOOM && n <= MAX_GRID_ZOOM) setZoomState(n);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { zoom, setZoom };
}
