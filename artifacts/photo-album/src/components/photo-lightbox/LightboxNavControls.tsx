import { X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export function LightboxNavControls({
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  isLoadingNext,
}: {
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isLoadingNext?: boolean;
}) {
  return (
    <>
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
          onClick={(e) => { e.stopPropagation(); if (!isLoadingNext) onNext(); }}
          disabled={!hasNext || isLoadingNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next photo"
          data-testid="lightbox-next"
        >
          {isLoadingNext ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ChevronRight className="h-6 w-6" />
          )}
        </button>
      )}
    </>
  );
}
