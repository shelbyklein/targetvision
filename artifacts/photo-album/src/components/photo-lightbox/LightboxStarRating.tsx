import { Star } from "lucide-react";
import { useState } from "react";
import { useRatePhoto, useClearPhotoRating } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function LightboxStarRating({
  photoId,
  myRating,
  averageRating,
  currentUserId,
  onRated,
  onAdvance,
}: {
  photoId: number;
  myRating?: number | null;
  averageRating?: number | null;
  currentUserId?: number;
  onRated: () => void;
  onAdvance?: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const { mutate: ratePhoto, isPending } = useRatePhoto();
  const { mutate: clearRating, isPending: isClearing } = useClearPhotoRating();
  const { toast } = useToast();

  const isSignedIn = currentUserId != null;
  const displayRating = hovered || myRating || 0;

  function handleRate(score: number) {
    if (!isSignedIn) {
      toast({ title: "Sign in to rate photos", variant: "destructive" });
      return;
    }
    ratePhoto(
      { id: photoId, data: { score } },
      {
        onSuccess: () => {
          onRated();
          onAdvance?.();
        },
        onError: () => toast({ title: "Failed to submit rating", variant: "destructive" }),
      }
    );
  }

  function handleClear() {
    clearRating(
      { id: photoId },
      {
        onSuccess: () => {
          onRated();
          toast({ title: "Rating cleared" });
        },
        onError: () => toast({ title: "Failed to clear rating", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-2" data-testid="lightbox-rating-section">
      <div className="flex items-center gap-1.5 text-white/70">
        <Star className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Rate this photo</span>
      </div>

      {averageRating != null && (
        <div className="flex items-center gap-1 text-xs text-white/60" data-testid="lightbox-average-rating">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-amber-400 font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-white/40">avg</span>
        </div>
      )}

      <div className="flex items-center gap-0.5" data-testid="lightbox-star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => isSignedIn && setHovered(star)}
            onMouseLeave={() => isSignedIn && setHovered(0)}
            disabled={isPending || isClearing || !isSignedIn}
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
            aria-pressed={myRating === star}
            data-testid={`lightbox-star-${star}`}
            className={cn(
              "p-0.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-amber-400",
              isSignedIn
                ? "hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                : "cursor-not-allowed opacity-50"
            )}
          >
            <Star
              className={
                displayRating >= star
                  ? "h-5 w-5 fill-amber-400 text-amber-400"
                  : "h-5 w-5 text-white/40 stroke-[1.75]"
              }
            />
          </button>
        ))}
        {myRating != null && (
          <span className="text-xs text-white/60 ml-1.5" data-testid="lightbox-my-rating">
            {myRating}/5
          </span>
        )}
      </div>

      {isSignedIn && myRating != null && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending || isClearing}
          className="text-xs text-white/50 hover:text-white/80 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          data-testid="lightbox-clear-rating"
        >
          Clear rating
        </button>
      )}

      {!isSignedIn && (
        <p className="text-xs text-white/40">Sign in to rate photos.</p>
      )}
    </div>
  );
}
