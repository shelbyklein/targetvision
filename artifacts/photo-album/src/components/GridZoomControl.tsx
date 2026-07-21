import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut } from "lucide-react";
import { MIN_GRID_ZOOM, MAX_GRID_ZOOM } from "@/hooks/useGridZoom";

// Compact −/+ density control for photo grids. Fewer photos per row = larger
// thumbnails (zoom in), more per row = smaller (zoom out).
export function GridZoomControl({ zoom, setZoom }: { zoom: number; setZoom: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5" role="group" aria-label="Grid zoom" data-testid="grid-zoom">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setZoom(zoom + 1)}
        disabled={zoom >= MAX_GRID_ZOOM}
        aria-label="Smaller thumbnails (more per row)"
        title="Smaller thumbnails"
        data-testid="grid-zoom-out"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setZoom(zoom - 1)}
        disabled={zoom <= MIN_GRID_ZOOM}
        aria-label="Larger thumbnails (fewer per row)"
        title="Larger thumbnails"
        data-testid="grid-zoom-in"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
