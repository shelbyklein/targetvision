import { useState, useRef, useEffect } from "react";
import { FadeImage } from "@/components/ui/fade-image";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetAlbum,
  useListAlbumPhotos,
  useUploadPhoto,
  useDeleteAlbum,
  useSetAlbumCover,
  useAcceptPhotoSuggestion,
  useDismissPhotoSuggestion,
  useAcceptPhotoNewCollectionSuggestion,
  useDismissPhotoNewCollectionSuggestion,
  useBulkUpdatePhotos,
  useBulkDeletePhotos,
  getGetAlbumQueryKey,
  getListAlbumPhotosQueryKey,
  getListAlbumsQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import type { Photo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Star,
  CalendarDays,
  Camera,
  ArrowLeft,
  Star as StarIcon,
  Trash2,
  Upload,
  ImagePlus,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Check,
  EyeOff,
  Eye,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SortOption = "newest" | "oldest" | "top-rated";

const PAGE_SIZE = 50;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface FileItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  errorMessage?: string;
}

function AddPhotoDialog({ albumId, onAdded }: { albumId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchIndices, setBatchIndices] = useState<ReadonlySet<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          preview: "",
          status: "error",
          progress: 0,
          errorMessage: "Only image files are supported",
        };
      }
      if (file.size > MAX_FILE_SIZE) {
        return {
          file,
          preview: URL.createObjectURL(file),
          status: "error",
          progress: 0,
          errorMessage: "File too large — max 100MB",
        };
      }
      return {
        file,
        preview: URL.createObjectURL(file),
        status: "pending",
        progress: 0,
      };
    });
    setFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function processIndices(indices: number[]): Promise<{ successCount: number; errorCount: number }> {
    if (!indices.length || isSubmitting) return { successCount: 0, errorCount: 0 };
    setIsSubmitting(true);

    const fileRefs = indices.map((index) => ({ index, file: files[index].file }));

    let successCount = 0;
    let errorCount = 0;
    const CONCURRENCY = 4;
    let cursor = 0;

    async function runNext(): Promise<void> {
      if (cursor >= fileRefs.length) return;
      const { index, file } = fileRefs[cursor++];

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "uploading", progress: 10, errorMessage: undefined } : f
        )
      );

      try {
        const result = await uploadFile(file);
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
      } catch {
        setFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, status: "error", progress: 0 } : f))
        );
        errorCount++;
      }

      await runNext();
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, fileRefs.length) }, runNext)
    );

    setIsSubmitting(false);
    return { successCount, errorCount };
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

  function handleClose(nextOpen: boolean) {
    if (!nextOpen && !isSubmitting) {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
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
    const { successCount, errorCount: uploadErrorCount } = await processIndices(pendingIndices);
    const totalErrors = preErrorCount + uploadErrorCount;

    setBatchIndices(new Set(pendingIndices));
    onAdded();

    if (totalErrors === 0) {
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
                  className="flex gap-3 items-start bg-muted/40 rounded-lg p-2.5"
                  data-testid="file-queue-item"
                >
                  <div className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted">
                    <img
                      src={item.preview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {item.status === "done" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-400" />
                      </div>
                    )}
                    {item.status === "error" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs text-muted-foreground truncate">{item.file.name}</p>
                    {item.status === "uploading" && (
                      <Progress value={item.progress} className="h-1" />
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
                  {item.status === "error" && !isSubmitting && (
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
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancel
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

function sortPhotos(
  photos: Array<{ id: number; createdAt: string; averageRating?: number | null; ratingCount: number }>,
  sort: SortOption
) {
  const sorted = [...photos];
  if (sort === "newest") {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === "oldest") {
    sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sort === "top-rated") {
    sorted.sort((a, b) => {
      const ratingDiff = (b.averageRating ?? 0) - (a.averageRating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      const countDiff = b.ratingCount - a.ratingCount;
      if (countDiff !== 0) return countDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  return sorted;
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const albumId = parseInt(id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [sort, setSort] = useState<SortOption>("newest");
  const [confirmNewCollection, setConfirmNewCollection] = useState<{
    photoId: number;
    suggestionId: number;
    name: string;
  } | null>(null);
  const [showHiddenLocal, setShowHiddenLocal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [offset, setOffset] = useState(0);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const { mutateAsync: bulkUpdatePhotos, isPending: bulkUpdating } = useBulkUpdatePhotos();
  const { mutateAsync: bulkDeletePhotos, isPending: bulkDeleting } = useBulkDeletePhotos();

  const { data: album, isLoading: albumLoading } = useGetAlbum(albumId, {
    query: { enabled: !!albumId, queryKey: getGetAlbumQueryKey(albumId) },
  });

  const photosParams = showHiddenLocal
    ? { includeHidden: true as const, limit: PAGE_SIZE, offset }
    : { limit: PAGE_SIZE, offset };
  const { data: photosPage, isLoading: photosPageLoading, isFetching: photosFetching } = useListAlbumPhotos(albumId, photosParams, {
    query: {
      enabled: !!albumId,
      queryKey: getListAlbumPhotosQueryKey(albumId, photosParams),
      refetchInterval: (q) => {
        const page = q.state.data as { photos?: Array<{ aiDescription?: string | null; createdAt?: string }> } | undefined;
        const data = page?.photos;
        if (!data) return false;
        const now = Date.now();
        const stillAnalyzing = data.some(
          (p) =>
            p.aiDescription == null &&
            p.createdAt &&
            now - new Date(p.createdAt).getTime() < 60_000,
        );
        return stillAnalyzing ? 10_000 : false;
      },
    },
  });

  const photosLoading = photosPageLoading && allPhotos.length === 0;
  const loadingMore = photosFetching && allPhotos.length > 0;
  const hasMore = photosPage?.hasMore ?? false;

  useEffect(() => {
    setOffset(0);
    setAllPhotos([]);
  }, [albumId, showHiddenLocal]);

  useEffect(() => {
    if (photosPage === undefined) return;
    const newPhotos = photosPage.photos;
    if (offset === 0) {
      setAllPhotos(newPhotos);
    } else {
      setAllPhotos((prev) => {
        const newMap = new Map(newPhotos.map((p) => [p.id, p]));
        const existingIds = new Set(prev.map((p) => p.id));
        const updated = prev.map((p) => newMap.get(p.id) ?? p);
        const appended = newPhotos.filter((p) => !existingIds.has(p.id));
        return [...updated, ...appended];
      });
    }
  }, [photosPage, offset]);
  const { mutate: setCover } = useSetAlbumCover();
  const { data: me } = useGetMe();
  const { mutate: deleteAlbum, isPending: deletingAlbum } = useDeleteAlbum();
  const { mutate: acceptSuggestion } = useAcceptPhotoSuggestion();
  const { mutate: dismissSuggestion } = useDismissPhotoSuggestion();
  const { mutate: acceptNewCollectionSuggestion, isPending: acceptingNewCollection } = useAcceptPhotoNewCollectionSuggestion();
  const { mutate: dismissNewCollectionSuggestion } = useDismissPhotoNewCollectionSuggestion();

  function handleAcceptSuggestion(photoId: number, collectionId: number) {
    acceptSuggestion(
      { id: photoId, collectionId },
      {
        onSuccess: invalidate,
        onError: () => toast({ title: "Failed to accept suggestion", variant: "destructive" }),
      },
    );
  }

  function handleDismissSuggestion(photoId: number, collectionId: number) {
    dismissSuggestion(
      { id: photoId, collectionId },
      {
        onSuccess: invalidate,
        onError: () => toast({ title: "Failed to dismiss suggestion", variant: "destructive" }),
      },
    );
  }

  function handleAcceptNewCollectionSuggestion(photoId: number, suggestionId: number, name: string) {
    acceptNewCollectionSuggestion(
      { id: photoId, suggestionId, data: { name } },
      {
        onSuccess: () => {
          setConfirmNewCollection(null);
          invalidate();
        },
        onError: () => toast({ title: "Failed to create collection", variant: "destructive" }),
      },
    );
  }

  function handleDismissNewCollectionSuggestion(photoId: number, suggestionId: number) {
    dismissNewCollectionSuggestion(
      { id: photoId, suggestionId },
      {
        onSuccess: invalidate,
        onError: () => toast({ title: "Failed to dismiss suggestion", variant: "destructive" }),
      },
    );
  }

  function invalidate() {
    setOffset(0);
    qc.invalidateQueries({ queryKey: getGetAlbumQueryKey(albumId) });
    qc.invalidateQueries({ queryKey: [`/api/albums/${albumId}/photos`] });
    qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
  }

  function toggleSelect(photoId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkVisibility(isHidden: boolean) {
    const ids = Array.from(selectedIds);
    try {
      const result = await bulkUpdatePhotos({ data: { ids, isHidden } });
      const count = result?.updated ?? ids.length;
      toast({
        title: isHidden
          ? `${count} photo${count !== 1 ? "s" : ""} hidden`
          : `${count} photo${count !== 1 ? "s" : ""} unhidden`,
      });
      clearSelection();
      invalidate();
    } catch {
      toast({ title: "Bulk action failed", variant: "destructive" });
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setConfirmBulkDelete(false);
    try {
      const result = await bulkDeletePhotos({ data: { ids } });
      const count = result?.deleted ?? ids.length;
      toast({
        title: `${count} photo${count !== 1 ? "s" : ""} deleted`,
      });
      clearSelection();
      invalidate();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  function handleSetCover(photoId: number) {
    setCover(
      { id: albumId, data: { photoId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAlbumQueryKey(albumId) });
          toast({ title: "Cover photo updated" });
        },
      }
    );
  }

  function handleDeleteAlbum() {
    deleteAlbum(
      { id: albumId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
          toast({ title: "Album deleted" });
          navigate("/albums");
        },
        onError: () =>
          toast({ title: "Failed to delete album", variant: "destructive" }),
      }
    );
  }

  const sortedPhotos = sortPhotos(
    showHiddenLocal ? allPhotos : allPhotos.filter((p) => !p.isHidden),
    sort,
  );

  if (albumLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!album) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">Album not found.</p>
          <Link href="/albums">
            <Button variant="outline" className="mt-4">
              Back to Albums
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="album-detail-page">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/albums">
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0"
                data-testid="back-to-albums"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1
                className="text-2xl font-bold text-foreground"
                data-testid="album-title"
              >
                {album.title}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {album.eventDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {album.eventDate}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5" />
                  {album.photoCount} photo{album.photoCount !== 1 ? "s" : ""}
                  {me?.role === "admin" && !!album.hiddenCount && (
                    <span className="flex items-center gap-1 text-muted-foreground/70">
                      <EyeOff className="h-3 w-3" />
                      {album.hiddenCount} hidden
                      <button
                        type="button"
                        onClick={() => setShowHiddenLocal((v) => !v)}
                        className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${showHiddenLocal ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground/70 hover:text-muted-foreground"}`}
                        data-testid="toggle-hidden-photos"
                        title={showHiddenLocal ? "Hide hidden photos" : "Show hidden photos"}
                      >
                        {showHiddenLocal ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {showHiddenLocal ? "hide" : "show"}
                      </button>
                    </span>
                  )}
                </span>
              </div>
              {album.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                  {album.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AddPhotoDialog albumId={albumId} onAdded={invalidate} />

            {me?.role === "admin" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="delete-album-btn"
                    title="Delete album"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this album?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{album.title}" and all its photos. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAlbum}
                      disabled={deletingAlbum}
                      className="bg-destructive hover:bg-destructive/90"
                      data-testid="confirm-delete-album"
                    >
                      {deletingAlbum ? "Deleting…" : "Delete Album"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {allPhotos.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as SortOption)}
              >
                <SelectTrigger className="h-8 w-36 text-sm" data-testid="sort-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="top-rated">Top rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {photosLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        ) : sortedPhotos.length > 0 ? (
          <>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            data-testid="photo-grid"
          >
            {sortedPhotos.map((photo) => {
              const isSelected = selectedIds.has(photo.id);
              return (
              <div
                key={photo.id}
                className={`relative group rounded-lg overflow-hidden bg-muted${isSelected ? " ring-2 ring-primary ring-offset-1" : ""}`}
                data-testid="photo-grid-item"
              >
                {me?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(photo.id)}
                    className={`absolute top-2 left-2 z-20 h-5 w-5 rounded border-2 transition-all ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground opacity-100"
                        : "bg-white/80 border-white/80 opacity-0 group-hover:opacity-100"
                    } flex items-center justify-center`}
                    aria-label={isSelected ? "Deselect photo" : "Select photo"}
                    data-testid="photo-select-checkbox"
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                )}
                <Link href={`/photos/${photo.id}`}>
                  <div className={`aspect-[4/3] overflow-hidden${photo.isHidden ? " opacity-60" : ""}`}>
                    <FadeImage
                      src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
                      alt={photo.name ?? "Photo"}
                      loading="lazy"
                      className="h-full w-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                </Link>

                {((photo.suggestedCollections && photo.suggestedCollections.length > 0) ||
                  (photo.suggestedNewCollections && photo.suggestedNewCollections.length > 0)) && (
                <div className="p-2 space-y-1">
                  {photo.suggestedCollections && photo.suggestedCollections.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5" data-testid="card-suggestions">
                      {photo.suggestedCollections.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/5 pl-1.5 pr-0.5 py-px text-[9px] text-foreground"
                          data-testid={`card-suggested-collection-${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <Sparkles className="h-2 w-2 text-primary" />
                          <span>Add to {s.title}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAcceptSuggestion(photo.id, s.id);
                            }}
                            className="rounded-full p-0.5 hover:bg-primary/20 text-primary"
                            aria-label={`Accept suggestion ${s.title}`}
                            data-testid={`card-accept-suggestion-${s.id}`}
                          >
                            <Check className="h-2 w-2" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDismissSuggestion(photo.id, s.id);
                            }}
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground"
                            aria-label={`Dismiss suggestion ${s.title}`}
                            data-testid={`card-dismiss-suggestion-${s.id}`}
                          >
                            <X className="h-2 w-2" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {photo.suggestedNewCollections && photo.suggestedNewCollections.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5" data-testid="card-new-collection-suggestions">
                      {photo.suggestedNewCollections.slice(0, 2).map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/40 bg-emerald-50/60 dark:bg-emerald-950/30 pl-1.5 pr-0.5 py-px text-[9px] text-foreground"
                          data-testid={`card-suggested-new-collection-${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <Sparkles className="h-2 w-2 text-emerald-600 dark:text-emerald-400" />
                          <span>New: {s.suggestedName}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmNewCollection({ photoId: photo.id, suggestionId: s.id, name: s.suggestedName });
                            }}
                            className="rounded-full p-0.5 hover:bg-emerald-200/60 dark:hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400"
                            aria-label={`Accept new collection suggestion ${s.suggestedName}`}
                            data-testid={`card-accept-new-collection-suggestion-${s.id}`}
                          >
                            <Check className="h-2 w-2" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDismissNewCollectionSuggestion(photo.id, s.id);
                            }}
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground"
                            aria-label={`Dismiss new collection suggestion ${s.suggestedName}`}
                            data-testid={`card-dismiss-new-collection-suggestion-${s.id}`}
                          >
                            <X className="h-2 w-2" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {photo.isHidden && (
                  <div
                    className="absolute top-2 left-2 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 z-10"
                    title="Hidden photo"
                    data-testid="hidden-badge"
                  >
                    <EyeOff className="h-2.5 w-2.5 text-white" />
                    <span className="text-[10px] font-semibold text-white leading-none">Hidden</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 pointer-events-none" />

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-white/90 hover:bg-white"
                        data-testid="photo-options-btn"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleSetCover(photo.id)}
                        className="gap-2"
                      >
                        <StarIcon className="h-4 w-4" />
                        Set as cover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {photo.averageRating != null && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/60 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-white font-medium">
                      {photo.averageRating.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-white/80 ml-0.5">
                      ({photo.ratingCount})
                    </span>
                  </div>
                )}

                {album.coverPhotoId === photo.id && (
                  <div className="absolute bottom-[3.5rem] left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                    Cover
                  </div>
                )}
              </div>
              );
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={loadingMore}
                data-testid="load-more-btn"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl"
            data-testid="no-photos"
          >
            <Camera className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No photos yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Upload the first photos to this album.
            </p>
            <AddPhotoDialog albumId={albumId} onAdded={invalidate} />
          </div>
        )}
      </div>

      {me?.role === "admin" && selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-foreground text-background shadow-xl px-5 py-3"
          data-testid="bulk-action-toolbar"
        >
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-4 bg-background/30" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-background hover:bg-background/20 hover:text-background gap-1.5"
            onClick={() => handleBulkVisibility(true)}
            disabled={bulkUpdating || bulkDeleting}
            data-testid="bulk-hide-btn"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-background hover:bg-background/20 hover:text-background gap-1.5"
            onClick={() => handleBulkVisibility(false)}
            disabled={bulkUpdating || bulkDeleting}
            data-testid="bulk-unhide-btn"
          >
            <Eye className="h-3.5 w-3.5" />
            Unhide selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-red-400 hover:bg-red-500/20 hover:text-red-300 gap-1.5"
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkUpdating || bulkDeleting}
            data-testid="bulk-delete-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </Button>
          <div className="w-px h-4 bg-background/30" />
          <button
            type="button"
            onClick={clearSelection}
            className="text-background/70 hover:text-background transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} photo{selectedIds.size !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedIds.size} selected photo{selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedIds.size === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="bulk-delete-confirm-btn"
            >
              {bulkDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={confirmNewCollection !== null}
        onOpenChange={(open) => { if (!open) setConfirmNewCollection(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create new collection</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Edit the name before creating this collection.
          </p>
          <Input
            value={confirmNewCollection?.name ?? ""}
            onChange={(e) =>
              setConfirmNewCollection((prev) =>
                prev ? { ...prev, name: e.target.value } : prev
              )
            }
            placeholder="Collection name"
            data-testid="confirm-new-collection-name-input"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && confirmNewCollection?.name.trim()) {
                handleAcceptNewCollectionSuggestion(
                  confirmNewCollection.photoId,
                  confirmNewCollection.suggestionId,
                  confirmNewCollection.name.trim(),
                );
              }
            }}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setConfirmNewCollection(null)}
              disabled={acceptingNewCollection}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmNewCollection?.name.trim()) {
                  handleAcceptNewCollectionSuggestion(
                    confirmNewCollection.photoId,
                    confirmNewCollection.suggestionId,
                    confirmNewCollection.name.trim(),
                  );
                }
              }}
              disabled={acceptingNewCollection || !confirmNewCollection?.name.trim()}
              data-testid="confirm-new-collection-btn"
            >
              {acceptingNewCollection ? "Creating…" : "Create collection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
