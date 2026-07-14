import type { DragEvent } from "react";

// Custom MIME type carrying a dragged photo's id. Using a custom type (rather
// than text/plain) lets drop targets cheaply detect a photo drag via
// `dataTransfer.types` without reading the payload (which is only readable on
// drop), and avoids colliding with ordinary text drags.
export const PHOTO_DND_MIME = "application/x-tv-photo-id";

/** Begin dragging a photo. Call from a photo element's `onDragStart`. */
export function startPhotoDrag(e: DragEvent, photoId: number): void {
  e.dataTransfer.setData(PHOTO_DND_MIME, String(photoId));
  e.dataTransfer.effectAllowed = "copy";
}

/** True while a photo is being dragged over this target. */
export function isPhotoDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(PHOTO_DND_MIME);
}

/** Read the dragged photo id on drop, or null if this isn't a photo drag. */
export function getDraggedPhotoId(e: DragEvent): number | null {
  const raw = e.dataTransfer.getData(PHOTO_DND_MIME);
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) ? id : null;
}
