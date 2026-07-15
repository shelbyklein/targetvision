import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, Download } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  useGetPhoto,
  useUpdatePhoto,
  useRatePhoto,
  useGetMe,
  getGetPhotoQueryKey,
  getGetTopRatedPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PhotoSidebarContent } from "@/components/photo-lightbox/PhotoSidebarContent";
import { LightboxImageArea } from "@/components/photo-lightbox/LightboxImageArea";
import { LightboxNavControls } from "@/components/photo-lightbox/LightboxNavControls";
import type { LightboxPhoto } from "@/components/photo-lightbox/types";

export type { LightboxPhoto };

interface PhotoLightboxProps {
  photo: LightboxPhoto | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isLoadingNext?: boolean;
  albumId?: number | null;
  coverPhotoId?: number | null;
  onDeleted?: (photoId: number) => void;
}

const SWIPE_THRESHOLD = 50;

export function PhotoLightbox({ photo, onClose, onPrev, onNext, hasPrev, hasNext, isLoadingNext, albumId, coverPhotoId, onDeleted }: PhotoLightboxProps) {
  const imgSrc = photo?.url ?? undefined;
  const touchStartX = useRef<number | null>(null);
  const qc = useQueryClient();
  const { mutate: ratePhotoKb } = useRatePhoto();

  const [localCoverPhotoId, setLocalCoverPhotoId] = useState<number | null | undefined>(coverPhotoId);
  useEffect(() => {
    setLocalCoverPhotoId(coverPhotoId);
  }, [coverPhotoId]);

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  useLayoutEffect(() => {
    if (photo?.id != null) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [photo?.id]);

  const handleAdvance = useCallback(() => {
    if (hasNext && onNext) onNext();
  }, [hasNext, onNext]);

  const { mutate: updatePhotoKb } = useUpdatePhoto();
  const { data: me } = useGetMe();
  const { toast: toastKb } = useToast();
  // Shares the cache with the sidebar's useGetPhoto (same query key) — no extra
  // request. Used to show the AI description directly under the photo.
  const { data: fullPhoto } = useGetPhoto(photo?.id ?? 0, {
    query: { enabled: !!photo?.id, queryKey: getGetPhotoQueryKey(photo?.id ?? 0) },
  });

  // Stable refs so keydown listeners always call the latest version
  const hideAndAdvanceRef = useRef<() => void>(() => {});
  hideAndAdvanceRef.current = useCallback(() => {
    if (!photo || me?.role !== "admin") return;
    updatePhotoKb(
      { id: photo.id, data: { isHidden: true } },
      {
        onSuccess: () => {
          toastKb({ title: "Photo hidden" });
          handleAdvance();
        },
      },
    );
  }, [photo, me, updatePhotoKb, toastKb, handleAdvance]);

  const rateAndAdvanceRef = useRef<(score: number) => void>(() => {});
  rateAndAdvanceRef.current = useCallback((score: number) => {
    if (!photo) return;
    ratePhotoKb(
      { id: photo.id, data: { score } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photo.id) });
          qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
          handleAdvance();
        },
      }
    );
  }, [photo, ratePhotoKb, qc, handleAdvance]);

  useEffect(() => {
    if (!photo) return;
    function handleKey(e: KeyboardEvent) {
      // Don't hijack keystrokes while the user is typing in a field (e.g. naming
      // a new collection) — otherwise arrow keys change photo, digits rate it,
      // and "h" hides it, all while they mean to be entering text.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      } else if ((e.key === "h" || e.key === "H") && me?.role === "admin") {
        e.preventDefault();
        hideAndAdvanceRef.current();
      } else {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 5) {
          e.preventDefault();
          rateAndAdvanceRef.current(digit);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photo, hasPrev, hasNext, onPrev, onNext]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0 && hasNext && onNext) {
      onNext();
    } else if (deltaX > 0 && hasPrev && onPrev) {
      onPrev();
    }
  }

  return (
    <DialogPrimitive.Root open={photo !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          data-testid="photo-lightbox"
          aria-label={photo?.name ?? "Photo preview"}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogPrimitive.Title className="sr-only">
            {photo?.name ?? "Photo preview"}
          </DialogPrimitive.Title>

          <LightboxNavControls
            onClose={onClose}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            isLoadingNext={isLoadingNext}
          />

          {photo && (
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 max-w-6xl w-full max-h-[90vh]">
              <LightboxImageArea
                photo={photo}
                imgSrc={imgSrc}
                imageLoading={imageLoading}
                imageError={imageError}
                aiDescription={fullPhoto?.aiDescription}
                onImageLoad={() => setImageLoading(false)}
                onImageError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />

              <div
                className="lg:w-64 shrink-0 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 space-y-3 lg:max-h-[85vh] lg:overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                data-testid="lightbox-sidebar"
              >
                <Link
                  href={`/photos/${photo.id}`}
                  onClick={onClose}
                  className="flex items-center gap-2 w-full rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors"
                  data-testid="lightbox-view-details-link"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  View full details
                </Link>

                <a
                  href={photo.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 w-full rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors"
                  data-testid="lightbox-download"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Download
                </a>

                <div className="border-t border-white/10 pt-3">
                  <PhotoSidebarContent
                    photoId={photo.id}
                    albumId={photo.albumId}
                    coverAlbumId={albumId}
                    coverPhotoId={localCoverPhotoId}
                    onAdvance={handleAdvance}
                    onCoverSet={(newCoverId) => setLocalCoverPhotoId(newCoverId)}
                    onDeleted={(deletedId) => { onDeleted?.(deletedId); onClose(); }}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
