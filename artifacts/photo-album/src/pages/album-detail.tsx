import { useState, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetAlbum,
  useListAlbumPhotos,
  useUploadPhoto,
  useDeleteAlbum,
  useSetAlbumCover,
  getGetAlbumQueryKey,
  getListAlbumPhotosQueryKey,
  getListAlbumsQueryKey,
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SortOption = "newest" | "oldest" | "top-rated";

interface FileItem {
  file: File;
  preview: string;
  caption: string;
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
      caption: "",
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

  function updateCaption(index: number, caption: string) {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, caption } : f))
    );
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
              caption: item.caption.trim() || undefined,
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
                    <Input
                      value={item.caption}
                      onChange={(e) => updateCaption(index, e.target.value)}
                      placeholder="Caption (optional)"
                      className="h-7 text-xs"
                      disabled={item.status !== "pending" || isSubmitting}
                      data-testid="photo-caption-input"
                    />
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

  const { data: album, isLoading: albumLoading } = useGetAlbum(albumId, {
    query: { enabled: !!albumId, queryKey: getGetAlbumQueryKey(albumId) },
  });
  const { data: photos, isLoading: photosLoading } = useListAlbumPhotos(albumId, {
    query: { enabled: !!albumId, queryKey: getListAlbumPhotosQueryKey(albumId) },
  });
  const { mutate: setCover } = useSetAlbumCover();
  const { mutate: deleteAlbum, isPending: deletingAlbum } = useDeleteAlbum();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetAlbumQueryKey(albumId) });
    qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId) });
    qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
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
            {sortedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-lg overflow-hidden bg-muted"
                data-testid="photo-grid-item"
              >
                <Link href={`/photos/${photo.id}`}>
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.caption ?? "Photo"}
                      className="h-full w-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                </Link>

                <div className="p-2 space-y-0.5">
                  {photo.caption ? (
                    <p className="text-xs font-medium text-foreground truncate">
                      {photo.caption}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic truncate">
                      No caption
                    </p>
                  )}
                  {photo.uploaderName && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      by {photo.uploaderName}
                    </p>
                  )}
                </div>

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
                  <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-white font-medium">
                      {photo.averageRating.toFixed(1)}
                    </span>
                  </div>
                )}

                {album.coverPhotoId === photo.id && (
                  <div className="absolute bottom-[3.5rem] left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                    Cover
                  </div>
                )}
              </div>
            ))}
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
    </AppLayout>
  );
}
