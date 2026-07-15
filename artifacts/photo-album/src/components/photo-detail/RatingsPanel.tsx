import type { Photo } from "@workspace/api-client-react";
import { Star } from "lucide-react";
import { StarRating } from "./StarRating";

export function RatingsPanel({ photo, photoId, currentUserId, onRated }: {
  photo: Photo;
  photoId: number;
  currentUserId?: number;
  onRated: () => void;
}) {
  return (
    <>
      {photo.ratingCount > 0 && (
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 flex items-center justify-between" data-testid="rating-summary">
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-foreground">
              {photo.averageRating?.toFixed(1) ?? "—"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {photo.ratingCount} rating{photo.ratingCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <StarRating
        photoId={photoId}
        myRating={photo.myRating}
        currentUserId={currentUserId}
        onRated={onRated}
      />

      {photo.ratings && photo.ratings.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2" data-testid="ratings-breakdown">
          <h3 className="text-sm font-semibold text-foreground">All ratings</h3>
          <ul className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {photo.ratings.map((r) => (
              <li
                key={r.userId}
                className="flex items-center justify-between text-sm"
                data-testid={`rating-row-${r.userId}`}
              >
                <span className="text-foreground truncate">
                  {r.userName ?? `User ${r.userId}`}
                  {currentUserId === r.userId && (
                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-foreground font-medium shrink-0">
                  {r.score}
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
