import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Star } from "lucide-react";

export interface LightboxPhoto {
  id: number;
  url: string;
  thumbnailKey?: string | null;
  name?: string | null;
  averageRating?: number | null;
}

interface PhotoLightboxProps {
  photo: LightboxPhoto | null;
  onClose: () => void;
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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          data-testid="photo-lightbox"
          aria-label={photo?.name ?? "Photo preview"}
        >
          <DialogPrimitive.Title className="sr-only">
            {photo?.name ?? "Photo preview"}
          </DialogPrimitive.Title>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close preview"
            data-testid="lightbox-close"
          >
            <X className="h-5 w-5" />
          </button>

          {photo && (
            <div className="flex flex-col items-center gap-4 max-w-5xl w-full max-h-[90vh]">
              <img
                src={imgSrc}
                alt={photo.name ?? "Photo"}
                className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
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
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
