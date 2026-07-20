import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Responsive column counts keyed by Tailwind breakpoint. `base` applies below
 * `sm` (640px); `sm` applies from 640px; `lg` applies from 1024px. Matches the
 * `columns-2 sm:columns-3 lg:columns-4` classes the grids previously used.
 */
export interface MasonryColumns {
  base: number;
  sm: number;
  lg: number;
}

const DEFAULT_COLUMNS: MasonryColumns = { base: 2, sm: 3, lg: 4 };

/**
 * Tracks the active masonry column count against the Tailwind `sm`/`lg`
 * breakpoints so the bucket distribution can be recomputed on resize.
 */
function useColumnCount(columns: MasonryColumns): number {
  const resolve = React.useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return columns.base;
    if (window.matchMedia("(min-width: 1024px)").matches) return columns.lg;
    if (window.matchMedia("(min-width: 640px)").matches) return columns.sm;
    return columns.base;
  }, [columns]);

  const [count, setCount] = React.useState(resolve);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const queries = [
      window.matchMedia("(min-width: 640px)"),
      window.matchMedia("(min-width: 1024px)"),
    ];
    const update = () => setCount(resolve());
    update();
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, [resolve]);

  return count;
}

export interface MasonryGridProps<T> {
  items: T[];
  /** Stable key per item (used so images don't reload when columns reflow). */
  getKey: (item: T) => React.Key;
  /** Render one item. Should return the existing item markup unchanged. */
  renderItem: (item: T, index: number) => React.ReactNode;
  columns?: MasonryColumns;
  /**
   * Fixed column count that overrides the responsive `columns` at every
   * breakpoint. Used by the per-grid zoom control; the zoom value is stored
   * per browser (each device keeps its own), so a fixed count is fine.
   */
  columnCountOverride?: number;
  className?: string;
  "data-testid"?: string;
}

/**
 * Masonry photo grid that lays items out in left-to-right reading order.
 *
 * Items are distributed round-robin into N column buckets (item i -> column
 * `i % N`), then each bucket is rendered as a vertical flex stack. This keeps
 * the staggered variable-height look of a CSS multi-column layout, but fixes
 * the ordering: item 1 lands top-left, item 2 to its right, and so on across
 * the top row first — instead of filling column one top-to-bottom, which is
 * how CSS `columns-*` fills content.
 *
 * Vertical spacing between items comes from each item's own `mb-3` (unchanged
 * from the previous markup); horizontal spacing between columns comes from the
 * outer flex `gap-3`. `break-inside-avoid` on items is a harmless no-op here.
 */
export function MasonryGrid<T>({
  items,
  getKey,
  renderItem,
  columns = DEFAULT_COLUMNS,
  columnCountOverride,
  className,
  "data-testid": testId,
}: MasonryGridProps<T>) {
  const responsiveCount = useColumnCount(columns);
  const columnCount =
    columnCountOverride && columnCountOverride > 0 ? columnCountOverride : responsiveCount;

  const buckets: { item: T; index: number }[][] = React.useMemo(() => {
    const cols: { item: T; index: number }[][] = Array.from(
      { length: columnCount },
      () => []
    );
    items.forEach((item, index) => {
      cols[index % columnCount].push({ item, index });
    });
    return cols;
  }, [items, columnCount]);

  return (
    <div className={cn("flex items-start gap-3", className)} data-testid={testId}>
      {buckets.map((bucket, colIndex) => (
        <div key={colIndex} className="flex min-w-0 flex-1 flex-col">
          {bucket.map(({ item, index }) => (
            <React.Fragment key={getKey(item)}>
              {renderItem(item, index)}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
