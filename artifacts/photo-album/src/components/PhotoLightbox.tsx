import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Star, FolderOpen, Loader2, ExternalLink, ChevronLeft, ChevronRight, Download, EyeOff, Eye, Check, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useGetPhoto,
  useListCollections,
  useAddPhotoToCollection,
  useRemovePhotoFromCollection,
  useUpdatePhoto,
  useGetMe,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
  getListPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FadeImage } from "@/components/ui/fade-image";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface LightboxPhoto {
  id: number;
  url: string;
  thumbnailKey?: string | null;
  name?: string | null;
  averageRating?: number | null;
  albumId?: number | null;
}

interface PhotoLightboxProps {
  photo: LightboxPhoto | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function PhotoSidebarContent({ photoId, albumId }: { photoId: number; albumId?: number | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: fullPhoto, isLoading: photoLoading } = useGetPhoto(photoId, {
    query: { queryKey: getGetPhotoQueryKey(photoId) },
  });
  const { data: allCollections, isLoading: collectionsLoading } = useListCollections();
  const { mutate: addToCollection, isPending: adding } = useAddPhotoToCollection();
  const { mutate: removeFromCollection, isPending: removing } = useRemovePhotoFromCollection();
  const { mutate: updatePhoto, isPending: updatingVisibility } = useUpdatePhoto();
  const { data: me } = useGetMe();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId) });
    }
    qc.invalidateQueries({ queryKey: getListPhotosQueryKey().slice(0, 1) });
  }

  function handleAdd(collectionId: string) {
    addToCollection(
      { id: parseInt(collectionId, 10), data: { photoId } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Added to collection" });
        },
        onError: () => toast({ title: "Failed to add to collection", variant: "destructive" }),
      }
    );
  }

  function handleRemove(collectionId: number, collectionTitle: string) {
    removeFromCollection(
      { id: collectionId, photoId },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `Removed from "${collectionTitle}"` });
        },
        onError: () => toast({ title: "Failed to remove from collection", variant: "destructive" }),
      }
    );
  }

  function handleToggleHidden() {
    const next = !fullPhoto?.isHidden;
    updatePhoto(
      { id: photoId, data: { isHidden: next } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: next ? "Photo hidden" : "Photo visible again" });
        },
        onError: () => toast({ title: "Failed to update photo", variant: "destructive" }),
      }
    );
  }

  const currentCollections = fullPhoto?.photoCollections ?? [];
  const isHidden = fullPhoto?.isHidden ?? false;

  if (photoLoading || collectionsLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="lightbox-collection-manager">
      {me?.role === "admin" && (
        <button
          type="button"
          onClick={handleToggleHidden}
          disabled={updatingVisibility}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
            isHidden
              ? "bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30"
              : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
          )}
          data-testid="lightbox-toggle-hidden"
        >
          {isHidden ? <Eye className="h-4 w-4 shrink-0" /> : <EyeOff className="h-4 w-4 shrink-0" />}
          {isHidden ? "Unhide photo" : "Hide photo"}
        </button>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-white/70">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Collections</span>
        </div>

        {allCollections && allCollections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="lightbox-collection-pills">
            {allCollections.map((col) => {
              const isIn = currentCollections.some((c) => c.id === col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() =>
                    isIn ? handleRemove(col.id, col.title) : handleAdd(String(col.id))
                  }
                  disabled={adding || removing}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50",
                    isIn
                      ? "bg-white text-gray-900 border border-white hover:bg-white/85"
                      : "bg-transparent text-white/65 border border-white/30 hover:bg-white/10 hover:text-white hover:border-white/50"
                  )}
                  data-testid={`lightbox-collection-pill-${col.id}`}
                  aria-label={isIn ? `Remove from ${col.title}` : `Add to ${col.title}`}
                  aria-pressed={isIn}
                >
                  {isIn ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0" />}
                  {col.title}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/40">No collections yet.</p>
        )}
      </div>
    </div>
  );
}

const SWIPE_THRESHOLD = 50;

export function PhotoLightbox({ photo, onClose, onPrev, onNext, hasPrev, hasNext }: PhotoLightboxProps) {
  const imgSrc = photo?.url ?? undefined;
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!photo) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
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

          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10"
            aria-label="Close preview"
            data-testid="lightbox-close"
          >
            <X className="h-5 w-5" />
          </button>

          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              disabled={!hasPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous photo"
              data-testid="lightbox-prev"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              disabled={!hasNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next photo"
              data-testid="lightbox-next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {photo && (
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 max-w-6xl w-full max-h-[90vh]">
              <div className="flex-1 flex flex-col items-center gap-3 min-w-0 overflow-hidden">
                <FadeImage
                  src={imgSrc!}
                  alt={photo.name ?? "Photo"}
                  className="max-h-[65vh] lg:max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
                  data-testid="lightbox-image"
                />

                <div className="flex items-center gap-3">
                  {photo.name && (
                    <span className="text-white font-medium text-sm" data-testid="lightbox-name">
                      {photo.name}
                    </span>
                  )}
                  {photo.averageRating != null && (
                    <div className="flex items-center gap-1" data-testid="lightbox-rating">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-amber-400 font-semibold text-sm">
                        {photo.averageRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

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
                  <PhotoSidebarContent photoId={photo.id} albumId={photo.albumId} />
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
