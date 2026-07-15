import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

export function PhotoDetailHeader({
  albumId,
  albumTitle,
  prevPhotoId,
  nextPhotoId,
  hasAlbumPhotos,
  currentIndex,
  totalPhotos,
  onNavigate,
}: {
  albumId: number;
  albumTitle?: string | null;
  prevPhotoId: number | null;
  nextPhotoId: number | null;
  hasAlbumPhotos: boolean;
  currentIndex: number;
  totalPhotos: number;
  onNavigate: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {albumId && (
          <Link href={`/albums/${albumId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="back-to-album">
              <ArrowLeft className="h-4 w-4" />
              {albumTitle ?? "Album"}
            </Button>
          </Link>
        )}
      </div>
      {albumId && (
        <div className="flex items-center gap-1" data-testid="photo-nav">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={prevPhotoId == null}
            onClick={() => prevPhotoId != null && onNavigate(prevPhotoId)}
            aria-label="Previous photo"
            data-testid="prev-photo-btn"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          {hasAlbumPhotos && currentIndex >= 0 && (
            <span className="text-xs text-muted-foreground px-1 tabular-nums" data-testid="photo-position">
              {currentIndex + 1} / {totalPhotos}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={nextPhotoId == null}
            onClick={() => nextPhotoId != null && onNavigate(nextPhotoId)}
            aria-label="Next photo"
            data-testid="next-photo-btn"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
