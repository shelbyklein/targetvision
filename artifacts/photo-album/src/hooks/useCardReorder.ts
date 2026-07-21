import { useCallback, useEffect, useMemo, useState } from "react";

// Custom drag type so card reordering can't be confused with photo drags
// (lib/photoDrag uses its own type) or native link/text drags.
const CARD_DRAG_TYPE = "application/x-tv-card-reorder";

/** Move `fromId` to `toId`'s position within `ids` (both in original order). */
function moveItem(ids: number[], fromId: number, toId: number): number[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

export interface CardReorderOptions {
  /** Ids of the rendered cards, in their current (server) order. */
  ids: number[];
  /** Called once on drop with the full new order of the rendered ids. */
  onCommit: (ids: number[]) => void;
  /** Disable dragging (e.g. while a search/tag filter narrows the list). */
  disabled?: boolean;
}

/**
 * HTML5 drag-to-reorder for card grids. Cards preview their new position
 * while dragging; drop commits the order via onCommit and keeps it applied
 * optimistically until the server list catches up.
 *
 * Handlers are keyed by card id (not render index), so the preview shifting
 * cards under the cursor can't confuse which card is which.
 *
 * Usage: render `arrange(items, getId)` instead of the raw list and spread
 * `handlers(getId(item))` onto each card's root element.
 */
export function useCardReorder({ ids, onCommit, disabled = false }: CardReorderOptions) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  // Drop the optimistic order once the server list reflects it (or the list
  // changes shape for another reason — deletes, creates).
  const idsKey = ids.join(",");
  useEffect(() => {
    if (localOrder && idsKey === localOrder.join(",")) setLocalOrder(null);
  }, [idsKey, localOrder]);

  const displayIds = useMemo(() => {
    if (dragId != null && overId != null && dragId !== overId) {
      return moveItem(ids, dragId, overId);
    }
    if (localOrder) {
      // Order known ids by the optimistic order; anything new appends.
      const position = new Map(localOrder.map((id, i) => [id, i]));
      return [...ids].sort(
        (a, b) => (position.get(a) ?? localOrder.length) - (position.get(b) ?? localOrder.length),
      );
    }
    return ids;
  }, [ids, dragId, overId, localOrder]);

  const arrange = useCallback(
    <T,>(items: T[], getId: (item: T) => number): T[] => {
      const position = new Map(displayIds.map((id, i) => [id, i]));
      return [...items].sort(
        (a, b) => (position.get(getId(a)) ?? Infinity) - (position.get(getId(b)) ?? Infinity),
      );
    },
    [displayIds],
  );

  const reset = useCallback(() => {
    setDragId(null);
    setOverId(null);
  }, []);

  const handlers = useCallback(
    (id: number) =>
      disabled
        ? {}
        : {
            draggable: true,
            onDragStart: (e: React.DragEvent) => {
              e.dataTransfer.setData(CARD_DRAG_TYPE, String(id));
              e.dataTransfer.effectAllowed = "move";
              setDragId(id);
              setOverId(id);
            },
            onDragOver: (e: React.DragEvent) => {
              if (dragId == null) return; // not our drag (e.g. a photo) — ignore
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (id !== overId) setOverId(id);
            },
            onDrop: (e: React.DragEvent) => {
              if (dragId == null) return;
              e.preventDefault();
              const finalIds =
                overId != null && dragId !== overId ? moveItem(ids, dragId, overId) : null;
              reset();
              if (finalIds) {
                setLocalOrder(finalIds);
                onCommit(finalIds);
              }
            },
            onDragEnd: reset,
          },
    [disabled, dragId, overId, ids, onCommit, reset],
  );

  return {
    /** Reorder the rendered items to match the drag preview / committed order. */
    arrange,
    /** Spread onto each card root, keyed by the card's id. */
    handlers,
    /** Id of the card currently being dragged, for styling (e.g. opacity). */
    draggingId: dragId,
  };
}
