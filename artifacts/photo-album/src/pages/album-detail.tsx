import { useState, useRef } from "react";
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
  getGetAlbumQueryKey,
  getListAlbumPhotosQueryKey,
  getListAlbumsQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useShowHiddenPhotos } from "@/hooks/use-show-hidden-photos";

type SortOption = "newest" | "oldest" | "top-rated";

interface FileItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
}

function AddPhotoDialog({ albumId, onAdded }: { albumId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: uploadPhoto } = useUploadPhoto();
  const { toast } = useToast();

  const { uploadFile } = useUpload({ basePath: "/api/storage" });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    const newItems: FileItem[] = selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen && !isSubmitting) {
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || isSubmitting) return;
    setIsSubmitting(true);

    let successCount = 0;
    let errorCount = 0;

    await Promise.all(
      files.map(async (item, index) => {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: "uploading", progress: 10 } : f
          )
        );

        try {
          const result = await uploadFile(item.file);
          if (!result) throw new Error("Upload failed");

          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, progress: 70 } : f
            )
          );

          await uploadPhoto({
            id: albumId,
            data: {
              url: `/api/storage${result.objectPath}`,
              storageKey: result.objectPath,
            },
          });

          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: "done", progress: 100 } : f
            )
          );
          successCount++;
        } catch {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: "error", progress: 0 } : f
            )
          );
          errorCount++;
        }
      })
    );

    setIsSubmitting(false);
    onAdded();

    if (errorCount === 0) {
      toast({
        title: successCount === 1 ? "Photo uploaded" : `${successCount} photos uploaded`,
      });
      handleClose(false);
    } else {
      toast({
        title: `${errorCount} photo${errorCount !== 1 ? "s" : ""} failed to upload`,
        variant: "destructive",
      });
    }
  }

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const canSubmit = pendingCount > 0 && !isSubmitting;

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
                </div>
              ))}
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
  const { showHidden } = useShowHiddenPhotos();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const { mutateAsync: bulkUpdatePhotos, isPending: bulkUpdating } = useBulkUpdatePhotos();

  const { data: album, isLoading: albumLoading } = useGetAlbum(albumId, {
    query: { enabled: !!albumId, queryKey: getGetAlbumQueryKey(albumId) },
  });
  const hiddenParams = showHidden ? { includeHidden: true } : undefined;
  const { data: photos, isLoading: photosLoading } = useListAlbumPhotos(albumId, hiddenParams, {
    query: {
      enabled: !!albumId,
      queryKey: getListAlbumPhotosQueryKey(albumId, hiddenParams),
      refetchInterval: (q) => {
        const data = q.state.data as Array<{ aiDescription?: string | null; createdAt?: string }> | undefined;
        if (!data) return false;
        const now = Date.now();
        const stillAnalyzing = data.some(
          (p) =>
            p.aiDescription == null &&
            p.createdAt &&
            now - new Date(p.createdAt).getTime() < 60_000,
        );
        return stillAnalyzing ? 3000 : false;
      },
    },
  });
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
    qc.invalidateQueries({ queryKey: getGetAlbumQueryKey(albumId) });
    qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId) });
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

  const sortedPhotos = photos ? sortPhotos(photos, sort) : undefined;

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
                    <span className="flex items-center gap-0.5 text-muted-foreground/70">
                      <EyeOff className="h-3 w-3" />
                      {album.hiddenCount} hidden
                    </span>
                  )}
                </span>
                {album.ownerName && <span>by {album.ownerName}</span>}
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

        {photos && photos.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
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
        ) : sortedPhotos && sortedPhotos.length > 0 ? (
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
                    <img
                      src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
                      alt={photo.name ?? "Photo"}
                      className="h-full w-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                </Link>

                {(photo.aiDescription ||
                  (photo.createdAt && Date.now() - new Date(photo.createdAt).getTime() < 60_000) ||
                  (photo.suggestedCollections && photo.suggestedCollections.length > 0) ||
                  (photo.suggestedNewCollections && photo.suggestedNewCollections.length > 0)) && (
                <div className="p-2 space-y-1">
                  {photo.aiDescription ? (
                    <p
                      className="text-[10px] text-muted-foreground line-clamp-2 flex items-start gap-1"
                      data-testid="card-ai-description"
                    >
                      <Sparkles className="h-2.5 w-2.5 text-primary mt-[2px] shrink-0" />
                      <span>{photo.aiDescription}</span>
                    </p>
                  ) : photo.createdAt && Date.now() - new Date(photo.createdAt).getTime() < 60_000 ? (
                    <p
                      className="text-[10px] text-muted-foreground/70 flex items-center gap-1"
                      data-testid="card-ai-loading"
                    >
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Analyzing…
                    </p>
                  ) : null}
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
            disabled={bulkUpdating}
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
            disabled={bulkUpdating}
            data-testid="bulk-unhide-btn"
          >
            <Eye className="h-3.5 w-3.5" />
            Unhide selected
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
