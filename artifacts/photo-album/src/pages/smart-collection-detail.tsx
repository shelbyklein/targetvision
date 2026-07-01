import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  useGetCollection,
  useListPhotos,
  getGetCollectionQueryKey,
} from "@workspace/api-client-react";
import type { Photo } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FadeImage } from "@/components/ui/fade-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { ArrowLeft, Sparkles, Star, ArrowUpDown } from "lucide-react";
import { collectionKeywords } from "@/lib/aiSuggestions";

type SortOption = "newest" | "oldest" | "top-rated" | "name-az";

type RichPhoto = Photo & { thumbnailKey?: string | null; name?: string | null };

function toLight(photo: RichPhoto): LightboxPhoto {
  return {
    id: photo.id,
    url: photo.url,
    thumbnailKey: photo.thumbnailKey,
    name: photo.name,
    averageRating: photo.averageRating,
    albumId: photo.albumId,
  };
}

function sortPhotos(photos: RichPhoto[], sort: SortOption): RichPhoto[] {
  const copy = [...photos];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":
      return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "top-rated":
      return copy.sort((a, b) => {
        const rd = (b.averageRating ?? 0) - (a.averageRating ?? 0);
        if (rd !== 0) return rd;
        return b.ratingCount - a.ratingCount;
      });
    case "name-az":
      return copy.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }
}

export default function SmartCollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const collectionId = parseInt(id, 10);

  const { data: collection, isLoading: collectionLoading } = useGetCollection(collectionId, {
    query: { enabled: !!collectionId, queryKey: getGetCollectionQueryKey(collectionId) },
  });

  const keywords = collection ? collectionKeywords(collection) : "";

  const { data: rawPhotos, isLoading: photosLoading } = useListPhotos(
    keywords ? { search: keywords, aiStatus: "has_description" } : undefined,
    { query: { enabled: !!keywords } },
  );

  const [sort, setSort] = useState<SortOption>("top-rated");
  const [selectedPhoto, setSelectedPhoto] = useState<LightboxPhoto | null>(null);

  const photos = useMemo(() => {
    if (!rawPhotos) return [];
    return sortPhotos(rawPhotos as RichPhoto[], sort);
  }, [rawPhotos, sort]);

  const selectedIndex = selectedPhoto ? photos.findIndex((p) => p.id === selectedPhoto.id) : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < photos.length - 1;

  const isLoading = collectionLoading || (!!keywords && photosLoading);

  if (!collectionLoading && !collection) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">Collection not found.</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="smart-collection-detail-page">
        <div className="flex items-start gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              {collectionLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h1 className="text-2xl font-bold text-foreground">{collection?.title}</h1>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              AI-suggested photos based on description match
            </p>
            {collection?.description && (
              <p className="text-xs text-muted-foreground max-w-xl">{collection.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-24 inline-block" />
            ) : (
              `${photos.length} photo${photos.length !== 1 ? "s" : ""} matched`
            )}
          </p>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="h-8 w-36 text-sm" data-testid="smart-sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-rated">Top rated</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name-az">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        ) : !keywords ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No keywords to match</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Add a more descriptive title or description to this collection so the AI can find matching photos.
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No AI matches yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Photos with AI descriptions matching "{collection?.title}" will appear here once they're analysed.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            data-testid="smart-collection-photo-grid"
          >
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(toLight(photo))}
                className="relative aspect-[4/3] rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                data-testid="smart-photo-item"
                aria-label={`Preview ${photo.name ?? "photo"}`}
              >
                <FadeImage
                  src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
                  alt={photo.name ?? "Photo"}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-2 opacity-0 group-hover:opacity-100">
                  {photo.averageRating != null && (
                    <div className="flex items-center gap-0.5 ml-auto bg-black/60 rounded px-1.5 py-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs text-white font-medium">
                        {photo.averageRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <PhotoLightbox
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => hasPrev && setSelectedPhoto(toLight(photos[selectedIndex - 1]))}
        onNext={() => hasNext && setSelectedPhoto(toLight(photos[selectedIndex + 1]))}
      />
    </AppLayout>
  );
}
