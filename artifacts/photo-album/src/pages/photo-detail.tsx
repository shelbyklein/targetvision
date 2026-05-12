import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPhoto,
  useRatePhoto,
  useAddPhotoTag,
  useRemovePhotoTag,
  useListCategories,
  useAddPhotoCategory,
  useRemovePhotoCategory,
  useDeletePhoto,
  useListTags,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
  getGetTagCloudQueryKey,
  getListTagsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Star, X, Plus, ArrowLeft, Trash2, CalendarDays, User, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function StarRating({ photoId, myRating, uploaderId, currentUserId, onRated }: {
  photoId: number;
  myRating?: number | null;
  uploaderId: number;
  currentUserId?: number;
  onRated: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const { mutate: ratePhoto, isPending } = useRatePhoto();
  const { toast } = useToast();

  const isOwn = currentUserId === uploaderId;

  function handleRate(score: number) {
    if (isOwn) {
      toast({ title: "Cannot rate your own photo", variant: "destructive" });
      return;
    }
    ratePhoto(
      { id: photoId, data: { score } },
      {
        onSuccess: () => {
          onRated();
          toast({ title: `Rated ${score} star${score !== 1 ? "s" : ""}` });
        },
        onError: () => toast({ title: "Failed to submit rating", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">
        {isOwn ? "Your photo" : "Your Rating"}
      </Label>
      <div className="flex items-center gap-1" data-testid="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            disabled={isPending || isOwn}
            className="p-0.5 disabled:cursor-not-allowed disabled:opacity-50 transition-transform hover:scale-110"
            data-testid={`star-${star}`}
          >
            <Star
              className={
                (hovered || myRating || 0) >= star
                  ? "h-6 w-6 fill-amber-400 text-amber-400"
                  : "h-6 w-6 text-muted-foreground/40"
              }
            />
          </button>
        ))}
        {myRating != null && (
          <span className="text-sm text-muted-foreground ml-2">({myRating}/5)</span>
        )}
      </div>
    </div>
  );
}

function TagAutocomplete({ photoId, existingTagIds, onTagAdded }: {
  photoId: number;
  existingTagIds: number[];
  onTagAdded: () => void;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mutate: addTag, isPending } = useAddPhotoTag();
  const { data: allTags } = useListTags();
  const { toast } = useToast();

  const suggestions = allTags
    ? allTags.filter(
        (t) =>
          t.name.toLowerCase().includes(input.toLowerCase()) &&
          !existingTagIds.includes(t.id) &&
          input.length > 0
      )
    : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function submit(tagName: string) {
    const trimmed = tagName.trim().toLowerCase();
    if (!trimmed) return;
    addTag(
      { id: photoId, data: { tagName: trimmed } },
      {
        onSuccess: () => {
          setInput("");
          setShowSuggestions(false);
          onTagAdded();
        },
        onError: () => toast({ title: "Failed to add tag", variant: "destructive" }),
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(input);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div ref={containerRef} className="relative mt-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Add tag..."
            className="h-8 text-sm"
            data-testid="add-tag-input"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden"
              data-testid="tag-suggestions"
            >
              {suggestions.slice(0, 6).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit(tag.name);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  data-testid={`tag-suggestion-${tag.id}`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          disabled={!input.trim() || isPending}
          data-testid="add-tag-submit"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

export default function PhotoDetail() {
  const { id } = useParams<{ id: string }>();
  const photoId = parseInt(id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: photo, isLoading } = useGetPhoto(photoId, {
    query: { enabled: !!photoId, queryKey: getGetPhotoQueryKey(photoId) },
  });
  const { data: me } = useGetMe();
  const { data: allCategories } = useListCategories();
  const { mutate: removeTag } = useRemovePhotoTag();
  const { mutate: addCategory } = useAddPhotoCategory();
  const { mutate: removeCategory } = useRemovePhotoCategory();
  const { mutate: deletePhoto, isPending: deleting } = useDeletePhoto();
  const [downloading, setDownloading] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (photo?.albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(photo.albumId) });
    }
  }

  function invalidateWithTags() {
    invalidate();
    qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTagCloudQueryKey() });
  }

  function handleRemoveTag(tagId: number) {
    removeTag(
      { id: photoId, tagId },
      { onSuccess: invalidateWithTags, onError: () => toast({ title: "Failed to remove tag", variant: "destructive" }) }
    );
  }

  function handleAddCategory(categoryId: string) {
    addCategory(
      { id: photoId, data: { categoryId: parseInt(categoryId, 10) } },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to add category", variant: "destructive" }) }
    );
  }

  function handleRemoveCategory(categoryId: number) {
    removeCategory(
      { id: photoId, categoryId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to remove category", variant: "destructive" }) }
    );
  }

  function deriveFilename(url: string, caption?: string | null, fallbackId?: number): string {
    let extension = "jpg";
    let urlBase = "";
    try {
      const u = new URL(url, window.location.href);
      const lastSegment = decodeURIComponent(u.pathname.split("/").pop() ?? "");
      const dotIndex = lastSegment.lastIndexOf(".");
      if (dotIndex > 0 && dotIndex < lastSegment.length - 1) {
        const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
        if (/^[a-z0-9]{2,5}$/.test(ext)) extension = ext;
        urlBase = lastSegment.slice(0, dotIndex);
      } else {
        urlBase = lastSegment;
      }
    } catch {
      // ignore
    }

    function sanitize(name: string): string {
      return name
        .trim()
        .replace(/[^a-zA-Z0-9-_ ]+/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
    }

    const captionBase = caption ? sanitize(caption) : "";
    const cleanedUrlBase = urlBase ? sanitize(urlBase) : "";
    const base =
      captionBase || cleanedUrlBase || `photo-${fallbackId ?? "image"}`;
    return `${base}.${extension}`;
  }

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDownload() {
    if (!photo) return;
    const filename = deriveFilename(photo.url, photo.caption, photo.id);
    setDownloading(true);
    try {
      let isSameOrigin = true;
      try {
        const u = new URL(photo.url, window.location.href);
        isSameOrigin = u.origin === window.location.origin;
      } catch {
        isSameOrigin = false;
      }

      if (isSameOrigin) {
        triggerDownload(photo.url, filename);
        toast({ title: "Download started" });
        return;
      }

      const response = await fetch(photo.url, { mode: "cors", credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        triggerDownload(objectUrl, filename);
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
      toast({ title: "Download started" });
    } catch (err) {
      toast({
        title: "Failed to download photo",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }

  function handleDelete() {
    deletePhoto(
      { id: photoId },
      {
        onSuccess: () => {
          toast({ title: "Photo deleted" });
          if (photo?.albumId) navigate(`/albums/${photo.albumId}`);
          else navigate("/albums");
        },
        onError: () => toast({ title: "Failed to delete photo", variant: "destructive" }),
      }
    );
  }

  const availableCategories = allCategories?.filter(
    (cat) => !photo?.categories?.some((c) => c.id === cat.id)
  );

  const canDelete = me && photo && (me.id === photo.uploaderId || me.role === "admin");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!photo) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">Photo not found.</p>
          <Link href="/albums"><Button variant="outline" className="mt-4">Back to Albums</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="photo-detail-page">
        <div className="flex items-center gap-3">
          {photo.albumId && (
            <Link href={`/albums/${photo.albumId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5" data-testid="back-to-album">
                <ArrowLeft className="h-4 w-4" />
                {photo.albumTitle ?? "Album"}
              </Button>
            </Link>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-muted aspect-[4/3]">
              <img
                src={photo.url}
                alt={photo.caption ?? "Photo"}
                className="h-full w-full object-contain bg-black"
                data-testid="photo-image"
              />
            </div>
            {photo.caption && (
              <p className="text-sm text-muted-foreground italic">{photo.caption}</p>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-foreground" data-testid="photo-title">
                {photo.caption ?? "Untitled Photo"}
              </h1>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {photo.uploaderName && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    <span>Uploaded by {photo.uploaderName}</span>
                  </div>
                )}
                {photo.takenAt && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{new Date(photo.takenAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {photo.ratingCount > 0 && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 flex items-center justify-between" data-testid="rating-summary">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">
                    {photo.averageRating?.toFixed(1) ?? "—"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {photo.ratingCount} rating{photo.ratingCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            <StarRating
              photoId={photoId}
              myRating={photo.myRating}
              uploaderId={photo.uploaderId}
              currentUserId={me?.id}
              onRated={invalidate}
            />

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]" data-testid="photo-tags">
                {photo.tags?.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                      data-testid={`remove-tag-${tag.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!photo.tags || photo.tags.length === 0) && (
                  <span className="text-xs text-muted-foreground">No tags yet</span>
                )}
              </div>
              <TagAutocomplete
                photoId={photoId}
                existingTagIds={photo.tags?.map((t) => t.id) ?? []}
                onTagAdded={invalidateWithTags}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Categories</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]" data-testid="photo-categories">
                {photo.categories?.map((cat) => (
                  <Badge key={cat.id} variant="outline" className="gap-1 pr-1">
                    {cat.name}
                    <button
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                      data-testid={`remove-category-${cat.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!photo.categories || photo.categories.length === 0) && (
                  <span className="text-xs text-muted-foreground">No categories</span>
                )}
              </div>
              {availableCategories && availableCategories.length > 0 && (
                <Select onValueChange={handleAddCategory} data-testid="add-category-select">
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder="Add category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)} data-testid={`category-option-${cat.id}`}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full"
              onClick={handleDownload}
              disabled={downloading}
              data-testid="download-photo-btn"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Downloading..." : "Download"}
            </Button>

            {canDelete && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2 w-full" data-testid="delete-photo-btn">
                      <Trash2 className="h-4 w-4" />
                      Delete Photo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The photo will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90" data-testid="confirm-delete-photo">
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
