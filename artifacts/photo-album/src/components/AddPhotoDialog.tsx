import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  ImagePlus,
  Image as ImageIcon,
  X,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePhotoUpload } from "@/contexts/PhotoUploadContext";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface FileItem {
  file: File;
  // Staging-only status; the actual upload run + progress lives in
  // PhotoUploadContext so it survives closing this dialog / navigating away.
  status: "pending" | "error";
  errorMessage?: string;
}

export function AddPhotoDialog({ albumId, albumTitle, onAdded }: { albumId: number; albumTitle?: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { start, phase } = usePhotoUpload();
  const isUploading = phase === "uploading";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    const newItems: FileItem[] = selected.map((file) => {
      if (!file.type.startsWith("image/")) {
        return { file, status: "error", errorMessage: "Only image files are supported" };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { file, status: "error", errorMessage: "File too large — max 100MB" };
      }
      return { file, status: "pending" };
    });
    setFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) setFiles([]);
    setOpen(nextOpen);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validFiles = files.filter((f) => f.status === "pending").map((f) => f.file);
    if (validFiles.length === 0) return;
    // Hand the batch to the provider (survives close/navigation) and get out of
    // the way — progress shows in the persistent banner.
    start(albumId, albumTitle ?? "this album", validFiles, onAdded);
    toast({ title: `Uploading ${validFiles.length} photo${validFiles.length !== 1 ? "s" : ""}…` });
    handleClose(false);
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const canSubmit = pendingCount > 0 && !isUploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm" data-testid="add-photo-btn" title="Add photos" aria-label="Add photos">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Photos</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors shrink-0"
            data-testid="file-drop-zone"
          >
            <ImagePlus className="h-7 w-7" />
            <span className="text-sm font-medium">Click to select photos</span>
            <span className="text-xs">Multiple files supported · JPG, PNG, GIF, WebP</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
            data-testid="photo-file-input"
          />

          {files.length > 0 && (
            <div className="overflow-y-auto space-y-2 flex-1 min-h-0 pr-1">
              {files.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-center bg-muted/40 rounded-lg p-2.5"
                  data-testid="file-queue-item"
                >
                  <div className="shrink-0 flex items-center justify-center h-8 w-8">
                    {item.status === "error" ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{item.file.name}</p>
                    {item.status === "error" && item.errorMessage && (
                      <p className="text-xs text-red-500">{item.errorMessage}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground shrink-0">
            Uploads continue in the background — you can close this and keep working.
          </p>

          <div className="flex justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} data-testid="cancel-upload-btn">
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} data-testid="upload-photo-submit">
              {`Upload ${pendingCount > 0 ? pendingCount : ""} Photo${pendingCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
