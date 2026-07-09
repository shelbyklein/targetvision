import { useState, useRef } from "react";
import { useUploadPhoto } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Upload,
  ImagePlus,
  Image as ImageIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface FileItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error" | "cancelled";
  progress: number;
  errorMessage?: string;
}

export function AddPhotoDialog({ albumId, onAdded }: { albumId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchIndices, setBatchIndices] = useState<ReadonlySet<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelControllerRef = useRef<AbortController | null>(null);
  const { mutateAsync: uploadPhoto } = useUploadPhoto();
  const { toast } = useToast();

  const { uploadFile } = useUpload({ basePath: "/api/storage" });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    const newItems: FileItem[] = selected.map((file) => {
      if (!file.type.startsWith("image/")) {
        return {
          file,
          status: "error",
          progress: 0,
          errorMessage: "Only image files are supported",
        };
      }
      if (file.size > MAX_FILE_SIZE) {
        return {
          file,
          status: "error",
          progress: 0,
          errorMessage: "File too large — max 100MB",
        };
      }
      return {
        file,
        status: "pending",
        progress: 0,
      };
    });
    setFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function processIndices(indices: number[]): Promise<{ successCount: number; errorCount: number; cancelCount: number }> {
    if (!indices.length || isSubmitting) return { successCount: 0, errorCount: 0, cancelCount: 0 };
    setIsSubmitting(true);

    const controller = new AbortController();
    cancelControllerRef.current = controller;
    const { signal } = controller;

    const fileRefs = indices.map((index) => ({ index, file: files[index].file }));

    let successCount = 0;
    let errorCount = 0;
    let cancelCount = 0;
    const CONCURRENCY = 4;
    let cursor = 0;

    async function runNext(): Promise<void> {
      if (cursor >= fileRefs.length) return;
      const { index, file } = fileRefs[cursor++];

      if (signal.aborted) {
        setFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, status: "cancelled", progress: 0 } : f))
        );
        cancelCount++;
        await runNext();
        return;
      }

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "uploading", progress: 10, errorMessage: undefined } : f
        )
      );

      try {
        const result = await uploadFile(file, undefined, signal);
        if (!result) throw new Error("Upload failed");

        setFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, progress: 70 } : f))
        );

        await uploadPhoto({
          id: albumId,
          data: {
            url: `/api/storage${result.objectPath}`,
            storageKey: result.objectPath,
            contentType: file.type,
          },
        });

        setFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, status: "done", progress: 100 } : f))
        );
        successCount++;
      } catch (err) {
        const isAbort =
          signal.aborted ||
          (err instanceof Error && (err.name === "AbortError" || err.message === "Upload aborted"));
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: isAbort ? "cancelled" : "error", progress: 0 } : f
          )
        );
        if (isAbort) {
          cancelCount++;
        } else {
          errorCount++;
        }
      }

      await runNext();
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, fileRefs.length) }, runNext)
    );

    cancelControllerRef.current = null;
    setIsSubmitting(false);
    return { successCount, errorCount, cancelCount };
  }

  function handleCancelBatch() {
    cancelControllerRef.current?.abort();
  }

  async function retryFile(index: number) {
    const { successCount, errorCount } = await processIndices([index]);
    onAdded();
    if (errorCount === 0) {
      toast({ title: successCount === 1 ? "Photo uploaded" : `${successCount} photos uploaded` });
    } else {
      toast({ title: "Photo failed to upload", variant: "destructive" });
    }
  }

  function handleCancelOrClose() {
    if (isSubmitting) {
      handleCancelBatch();
    } else {
      handleClose(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen && !isSubmitting) {
      setFiles([]);
      setBatchIndices(new Set());
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || isSubmitting) return;

    const pendingIndices = files
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "pending")
      .map(({ index }) => index);

    const preErrorCount = files.filter((item) => item.status === "error").length;
    const { successCount, errorCount: uploadErrorCount, cancelCount } = await processIndices(pendingIndices);
    const totalErrors = preErrorCount + uploadErrorCount;

    setBatchIndices(new Set(pendingIndices));
    if (successCount > 0) onAdded();

    if (cancelCount > 0 && successCount === 0 && totalErrors === 0) {
      toast({ title: "Upload cancelled" });
    } else if (cancelCount > 0) {
      if (successCount > 0) {
        toast({
          title: `${successCount} photo${successCount !== 1 ? "s" : ""} uploaded — ${cancelCount} cancelled`,
        });
      } else {
        toast({ title: `${cancelCount} photo${cancelCount !== 1 ? "s" : ""} cancelled`, variant: "destructive" });
      }
    } else if (totalErrors === 0) {
      toast({
        title: successCount === 1 ? "Photo uploaded" : `${successCount} photos uploaded`,
      });
      handleClose(false);
    } else {
      toast({
        title: `${totalErrors} photo${totalErrors !== 1 ? "s" : ""} failed to upload`,
        variant: "destructive",
      });
    }
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const canSubmit = pendingCount > 0 && !isSubmitting;

  const batchCount = batchIndices.size;
  const completedInBatch = files.filter(
    (f, i) => batchIndices.has(i) && (f.status === "done" || f.status === "error")
  ).length;
  const allTerminal = batchCount > 0 && completedInBatch === batchCount;
  const overallProgress = allTerminal
    ? 100
    : batchCount > 0
    ? Math.min(99, Math.floor((completedInBatch / batchCount) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm" data-testid="add-photo-btn">
          <Plus className="h-4 w-4" />
          Add Photos
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
            disabled={isSubmitting}
            className="w-full border-2 border-dashed border-border rounded-lg py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
            <div className="overflow-y-auto space-y-3 flex-1 min-h-0 pr-1">
              {files.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-3 items-center bg-muted/40 rounded-lg p-2.5"
                  data-testid="file-queue-item"
                >
                  <div className="shrink-0 flex items-center justify-center h-8 w-8">
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : item.status === "cancelled" ? (
                      <X className="h-5 w-5 text-yellow-500" />
                    ) : item.status === "uploading" ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs text-muted-foreground truncate">{item.file.name}</p>
                    {item.status === "uploading" && (
                      <Progress value={item.progress} className="h-1" />
                    )}
                    {item.status === "cancelled" && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">Cancelled</p>
                    )}
                    {item.status === "error" && item.errorMessage && (
                      <p className="text-xs text-red-500">{item.errorMessage}</p>
                    )}
                  </div>

                  {item.status === "pending" && !isSubmitting && (
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {(item.status === "error" || item.status === "cancelled") && !isSubmitting && (
                    <button
                      type="button"
                      onClick={() => retryFile(index)}
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Retry"
                      data-testid="retry-file-btn"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isSubmitting && batchCount > 0 && (
            <div className="space-y-1.5 shrink-0" data-testid="overall-progress">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Overall progress</span>
                <span>{completedInBatch} / {batchCount} photos uploaded</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          <div className="flex justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelOrClose}
              data-testid="cancel-upload-btn"
            >
              {isSubmitting ? "Stop Upload" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              data-testid="upload-photo-submit"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Upload className="h-4 w-4 animate-bounce" />
                  Uploading…
                </span>
              ) : (
                `Upload ${pendingCount > 0 ? pendingCount : ""} Photo${pendingCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
