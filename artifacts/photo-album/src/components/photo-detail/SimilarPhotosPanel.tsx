import { Link } from "wouter";
import {
  useListSimilarPhotos,
  getListSimilarPhotosQueryKey,
} from "@workspace/api-client-react";
import { FadeImage } from "@/components/ui/fade-image";
import { Sparkles } from "lucide-react";

// Image-embedding "more like this". Renders nothing when the photo has no
// embedding yet or has no neighbours, so it's invisible until embeddings exist.
export function SimilarPhotosPanel({ photoId }: { photoId: number }) {
  const { data: photos, isLoading } = useListSimilarPhotos(photoId, undefined, {
    query: { enabled: !!photoId, queryKey: getListSimilarPhotosQueryKey(photoId) },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Similar Photos</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!photos || photos.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="similar-photos-panel">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Similar Photos</h2>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {photos.map((p) => (
          <Link
            key={p.id}
            href={`/photos/${p.id}`}
            className="group block aspect-square rounded-lg overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            data-testid={`similar-photo-${p.id}`}
          >
            <FadeImage
              src={p.thumbnailKey ? `/api/storage${p.thumbnailKey}` : p.url}
              alt={p.filename ?? "Photo"}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
