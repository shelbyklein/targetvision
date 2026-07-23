import type { Dispatch, RefObject, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  isDragOver: boolean;
  setIsDragOver: Dispatch<SetStateAction<boolean>>;
  isProcessingDrop: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onPhotoInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// Photo-first drop zone: pick or drop image files. Dropping a folder of photos
// also works (the page harvests its images); zip support was removed — photos
// only, to keep the upload UX simple.
export function DropZone({
  isDragOver,
  setIsDragOver,
  isProcessingDrop,
  photoInputRef,
  onDrop,
  onPhotoInput,
}: DropZoneProps) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "relative border-2 border-dashed rounded-xl py-10 flex flex-col items-center justify-center gap-3 transition-colors cursor-default",
        isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
      )}
    >
      {isProcessingDrop ? (
        <>
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">Reading contents…</p>
        </>
      ) : (
        <>
          <Upload className="h-9 w-9 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop photos here</p>
            <p className="text-xs text-muted-foreground mt-1">Drag and drop photos (or a folder of photos)</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => photoInputRef.current?.click()} data-testid="pick-photos-btn">
            <ImagePlus className="h-4 w-4" />
            Pick Photos
          </Button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPhotoInput}
            data-testid="photo-input"
          />
        </>
      )}
    </div>
  );
}
