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

  // Replace the browser's default drag image with a little tilted thumbnail of
  // the photo plus a "+" badge, so it feels like you're carrying the photo to a
  // project. Falls back to the default drag image if there's no <img> to clone.
  const img = e.currentTarget.querySelector("img");
  if (img instanceof HTMLImageElement && img.src) {
    const ghost = buildDragGhost(img.src);
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 44, 44);
    // The browser snapshots the element synchronously; drop it next frame.
    requestAnimationFrame(() => ghost.remove());
  }
}

function buildDragGhost(src: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:fixed",
    "top:-1000px",
    "left:-1000px",
    "width:88px",
    "height:88px",
    "border-radius:14px",
    "overflow:hidden",
    "transform:rotate(-5deg)",
    "border:3px solid rgba(255,255,255,0.95)",
    "box-shadow:0 12px 28px rgba(0,0,0,0.5)",
  ].join(";");

  const image = document.createElement("img");
  image.src = src;
  image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
  el.appendChild(image);

  const badge = document.createElement("div");
  badge.textContent = "+";
  badge.style.cssText = [
    "position:absolute",
    "right:-4px",
    "bottom:-4px",
    "width:28px",
    "height:28px",
    "border-radius:9999px",
    "background:#ef4444",
    "color:#fff",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "font:700 18px/1 system-ui,sans-serif",
    "box-shadow:0 2px 8px rgba(0,0,0,0.45)",
  ].join(";");
  el.appendChild(badge);

  return el;
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
