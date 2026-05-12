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
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function AddPhotoDialog({ albumId, onAdded }: { albumId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadPhoto, isPending: isSaving } = useUploadPhoto();
  const { toast } = useToast();

  const { uploadFile, isUploading, progress } = useUpload({
    basePath: "/api/storage",
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  }

  function clearFile() {
    setSelectedFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(open: boolean) {
    if (!open) {
      clearFile();
      setCaption("");
    }
    setOpen(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    const uploadResult = await uploadFile(selectedFile);
    if (!uploadResult) {
      toast({ title: "Upload failed", description: "Could not upload the image.", variant: "destructive" });
      return;
    }

    const servingUrl = `/api/storage${uploadResult.objectPath}`;

    uploadPhoto(
      {
        id: albumId,
        data: {
          url: servingUrl,
          storageKey: uploadResult.objectPath,
          caption: caption.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          handleClose(false);
          onAdded();
          toast({ title: "Photo uploaded" });
        },
        onError: () =>
          toast({ title: "Failed to save photo", variant: "destructive" }),
      }
    );
  }

  const isBusy = isUploading || isSaving;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm" data-testid="add-photo-btn">
          <Plus className="h-4 w-4" />
          Add Photo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Photo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {preview ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted aspect-video">
              <img
                src={preview}
                alt="Preview"
                className="h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={clearFile}
                disabled={isBusy}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors disabled:opacity-50"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              data-testid="file-drop-zone"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm font-medium">Click to select a photo</span>
              <span className="text-xs">JPG, PNG, GIF, WebP supported</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="photo-file-input"
          />

          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Upload className="h-3 w-3 animate-bounce" />
                  Uploading…
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="photo-caption">Caption (optional)</Label>
            <Input
              id="photo-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              disabled={isBusy}
              data-testid="photo-caption-input"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isBusy || !selectedFile}
              data-testid="upload-photo-submit"
            >
              {isUploading ? "Uploading…" : isSaving ? "Saving…" : "Upload Photo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const albumId = parseInt(id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

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
        onError: () => toast({ title: "Failed to delete album", variant: "destructive" }),
      }
    );
  }

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
              <h1 className="text-2xl font-bold text-foreground" data-testid="album-title">
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
                <Button variant="ghost" size="icon" data-testid="delete-album-btn">
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

        {photosLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : photos && photos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3" data-testid="photo-grid">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-lg overflow-hidden aspect-square bg-muted"
                data-testid="photo-grid-item"
              >
                <Link href={`/photos/${photo.id}`}>
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Photo"}
                    className="h-full w-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                  />
                </Link>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 pointer-events-none" />
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
                  <div className="absolute bottom-2 left-2 flex items-center gap-0.5 bg-black/60 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-white font-medium">
                      {photo.averageRating.toFixed(1)}
                    </span>
                  </div>
                )}
                {album.coverPhotoId === photo.id && (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
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
              Upload the first photo to this album.
            </p>
            <AddPhotoDialog albumId={albumId} onAdded={invalidate} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
