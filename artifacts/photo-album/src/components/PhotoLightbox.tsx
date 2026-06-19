import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Star, FolderOpen, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import {
  useGetPhoto,
  useListCollections,
  useAddPhotoToCollection,
  useRemovePhotoFromCollection,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FadeImage } from "@/components/ui/fade-image";
import { useToast } from "@/hooks/use-toast";

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
}

function CollectionManager({ photoId, albumId }: { photoId: number; albumId?: number | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: fullPhoto, isLoading: photoLoading } = useGetPhoto(photoId, {
    query: { queryKey: getGetPhotoQueryKey(photoId) },
  });
  const { data: allCollections, isLoading: collectionsLoading } = useListCollections();
  const { mutate: addToCollection, isPending: adding } = useAddPhotoToCollection();
  const { mutate: removeFromCollection, isPending: removing } = useRemovePhotoFromCollection();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId) });
    }
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

  const currentCollections = fullPhoto?.photoCollections ?? [];
  const availableCollections = (allCollections ?? []).filter(
    (col) => !currentCollections.some((c) => c.id === col.id)
  );

  if (photoLoading || collectionsLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="lightbox-collection-manager">
      <div className="flex items-center gap-1.5 text-white/80">
        <FolderOpen className="h-4 w-4" />
        <span className="text-sm font-medium">Collections</span>
      </div>

      {currentCollections.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="lightbox-current-collections">
          {currentCollections.map((col) => (
            <Badge
              key={col.id}
              variant="secondary"
              className="gap-1.5 pl-2.5 pr-1 py-1 bg-white/15 text-white border-white/20 hover:bg-white/20"
              data-testid={`lightbox-collection-badge-${col.id}`}
            >
              {col.title}
              <button
                type="button"
                onClick={() => handleRemove(col.id, col.title)}
                disabled={removing}
                className="rounded-full p-0.5 hover:bg-white/20 transition-colors disabled:opacity-50"
                aria-label={`Remove from ${col.title}`}
                data-testid={`lightbox-remove-collection-${col.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/50" data-testid="lightbox-no-collections">
          Not in any collection yet.
        </p>
      )}

      {availableCollections.length > 0 && (
        <Select onValueChange={handleAdd} disabled={adding} value="">
          <SelectTrigger
            className="h-8 text-xs bg-white/10 border-white/20 text-white w-48 data-[placeholder]:text-white/60"
            data-testid="lightbox-add-collection-select"
          >
            <SelectValue placeholder="Add to collection…" />
          </SelectTrigger>
          <SelectContent>
            {availableCollections.map((col) => (
              <SelectItem key={col.id} value={String(col.id)}>
                {col.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  const imgSrc = photo?.url ?? undefined;

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
                className="lg:w-64 shrink-0 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 space-y-4"
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
                <CollectionManager photoId={photo.id} albumId={photo.albumId} />
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
