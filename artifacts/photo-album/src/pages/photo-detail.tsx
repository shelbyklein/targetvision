import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPhoto,
  useRatePhoto,
  useClearPhotoRating,
  useAddPhotoTag,
  useRemovePhotoTag,
  useListCategories,
  useAddPhotoCategory,
  useRemovePhotoCategory,
  useDeletePhoto,
  useListTags,
  useListCollections,
  useAddPhotoToCollection,
  useRemovePhotoFromCollection,
  useAcceptPhotoSuggestion,
  useDismissPhotoSuggestion,
  useAcceptPhotoTagSuggestion,
  useDismissPhotoTagSuggestion,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
  getListPhotosQueryKey,
  getGetRecentPhotosQueryKey,
  getGetTopRatedPhotosQueryKey,
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
import { Star, X, Plus, ArrowLeft, Trash2, CalendarDays, User, Download, FolderOpen, Sparkles, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function StarRating({ photoId, myRating, currentUserId, onRated }: {
  photoId: number;
  myRating?: number | null;
  currentUserId?: number;
  onRated: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const { mutate: ratePhoto, isPending } = useRatePhoto();
  const { mutate: clearRating, isPending: isClearing } = useClearPhotoRating();
  const { toast } = useToast();

  const isSignedIn = currentUserId != null;
  const interactive = isSignedIn;
  const displayRating = hovered || myRating || 0;

  function handleClear() {
    clearRating(
      { id: photoId },
      {
        onSuccess: () => {
          onRated();
          toast({ title: "Rating cleared" });
        },
        onError: () => toast({ title: "Failed to clear rating", variant: "destructive" }),
      }
    );
  }

  function handleRate(score: number) {
    if (!isSignedIn) {
      toast({ title: "Sign in to rate photos", variant: "destructive" });
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
    <div className="rounded-lg border border-border bg-card p-4 space-y-3" data-testid="rating-section">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Rate this photo</h2>
        <p className="text-xs text-muted-foreground">
          {!isSignedIn
            ? "Sign in to give this photo a rating from 1 to 5 stars."
            : myRating != null
              ? "Tap a star to update your rating."
              : "Tap a star to rate from 1 (lowest) to 5 (highest)."}
        </p>
      </div>
      <div className="flex items-center gap-1.5" data-testid="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(0)}
            disabled={isPending || isClearing || !interactive}
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
            aria-pressed={myRating === star}
            className={
              interactive
                ? "p-1 rounded-md transition-all hover:scale-110 hover:bg-amber-50 dark:hover:bg-amber-950/30 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:cursor-not-allowed"
                : "p-1 rounded-md cursor-not-allowed"
            }
            data-testid={`star-${star}`}
          >
            <Star
              className={
                displayRating >= star
                  ? "h-7 w-7 fill-amber-400 text-amber-400"
                  : interactive
                    ? "h-7 w-7 text-muted-foreground/70 stroke-[1.75]"
                    : "h-7 w-7 text-muted-foreground/40 stroke-[1.75]"
              }
            />
          </button>
        ))}
        {myRating != null && (
          <span className="text-sm font-medium text-foreground ml-2" data-testid="my-rating-text">
            Your rating: {myRating}/5
          </span>
        )}
      </div>
      {interactive && myRating != null && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending || isClearing}
          className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="clear-rating"
        >
          Clear rating
        </button>
      )}
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
    query: {
      enabled: !!photoId,
      queryKey: getGetPhotoQueryKey(photoId),
      refetchInterval: (q) => {
        const data = q.state.data as { aiDescription?: string | null; createdAt?: string } | undefined;
        if (!data || data.aiDescription != null) return false;
        const created = data.createdAt ? new Date(data.createdAt).getTime() : 0;
        if (!created || Date.now() - created > 60_000) return false;
        return 3000;
      },
    },
  });
  const { data: me } = useGetMe();
  const { data: allCategories } = useListCategories();
  const { data: allCollections } = useListCollections();
  const { mutate: removeTag } = useRemovePhotoTag();
  const { mutate: addCategory } = useAddPhotoCategory();
  const { mutate: removeCategory } = useRemovePhotoCategory();
  const { mutate: addToCollection } = useAddPhotoToCollection();
  const { mutate: removeFromCollection } = useRemovePhotoFromCollection();
  const { mutate: acceptSuggestion } = useAcceptPhotoSuggestion();
  const { mutate: dismissSuggestion } = useDismissPhotoSuggestion();
  const { mutate: acceptTagSuggestion } = useAcceptPhotoTagSuggestion();
  const { mutate: dismissTagSuggestion } = useDismissPhotoTagSuggestion();
  const { mutate: deletePhoto, isPending: deleting } = useDeletePhoto();
  const [downloading, setDownloading] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (photo?.albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(photo.albumId) });
    }
    qc.invalidateQueries({ queryKey: getListPhotosQueryKey().slice(0, 1) });
    qc.invalidateQueries({ queryKey: getGetRecentPhotosQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
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

  function handleAcceptSuggestion(collectionId: number) {
    acceptSuggestion(
      { id: photoId, collectionId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to accept suggestion", variant: "destructive" }) }
    );
  }

  function handleDismissSuggestion(collectionId: number) {
    dismissSuggestion(
      { id: photoId, collectionId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to dismiss suggestion", variant: "destructive" }) }
    );
  }

  function handleAcceptTagSuggestion(tagName: string) {
    acceptTagSuggestion(
      { id: photoId, tagName },
      {
        onSuccess: invalidateWithTags,
        onError: () => toast({ title: "Failed to accept tag", variant: "destructive" }),
      }
    );
  }

  function handleDismissTagSuggestion(tagName: string) {
    dismissTagSuggestion(
      { id: photoId, tagName },
      {
        onSuccess: invalidate,
        onError: () => toast({ title: "Failed to dismiss tag", variant: "destructive" }),
      }
    );
  }

  function handleAddCollection(collectionId: string) {
    addToCollection(
      { id: parseInt(collectionId, 10), data: { photoId } },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to add to collection", variant: "destructive" }) }
    );
  }

  function handleRemoveFromCollection(collectionId: number) {
    removeFromCollection(
      { id: collectionId, photoId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to remove from collection", variant: "destructive" }) }
    );
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

  const availableCollections = allCollections?.filter(
    (col) => !photo?.photoCollections?.some((c) => c.id === col.id)
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
            <div
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-2"
              data-testid="ai-description-block"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                AI description
              </div>
              {photo.aiDescription ? (
                <p className="text-sm text-foreground" data-testid="ai-description-text">
                  {photo.aiDescription}
                </p>
              ) : photo.createdAt && Date.now() - new Date(photo.createdAt).getTime() < 60_000 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="ai-description-loading">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing photo…
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic">No description available.</p>
              )}
              {photo.suggestedCollections && photo.suggestedCollections.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Suggested collections
                  </p>
                  <div className="flex flex-wrap gap-1.5" data-testid="suggested-collections">
                    {photo.suggestedCollections.map((s) => (
                      <div
                        key={s.id}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 pl-2.5 pr-1 py-0.5 text-xs"
                        data-testid={`suggested-collection-${s.id}`}
                      >
                        <Sparkles className="h-3 w-3 text-primary" />
                        <span className="text-foreground">{s.title}</span>
                        <button
                          onClick={() => handleAcceptSuggestion(s.id)}
                          className="rounded-full p-0.5 hover:bg-primary/15 text-primary"
                          aria-label="Accept suggestion"
                          data-testid={`accept-suggestion-${s.id}`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(s.id)}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/15 text-muted-foreground"
                          aria-label="Dismiss suggestion"
                          data-testid={`dismiss-suggestion-${s.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
              currentUserId={me?.id}
              onRated={invalidate}
            />

            {photo.ratings && photo.ratings.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2" data-testid="ratings-breakdown">
                <h3 className="text-sm font-semibold text-foreground">All ratings</h3>
                <ul className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {photo.ratings.map((r) => (
                    <li
                      key={r.userId}
                      className="flex items-center justify-between text-sm"
                      data-testid={`rating-row-${r.userId}`}
                    >
                      <span className="text-foreground truncate">
                        {r.userName ?? "Unknown"}
                        {me?.id === r.userId && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-foreground font-medium shrink-0">
                        {r.score}
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
              {photo.suggestedTags && photo.suggestedTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Suggested
                  </p>
                  <div className="flex flex-wrap gap-1.5" data-testid="suggested-tags">
                    {photo.suggestedTags.map((s) => (
                      <div
                        key={s.name}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 pl-2.5 pr-1 py-0.5 text-xs"
                        data-testid={`suggested-tag-${s.name}`}
                      >
                        <span className="text-foreground">{s.name}</span>
                        <button
                          onClick={() => handleAcceptTagSuggestion(s.name)}
                          className="rounded-full p-0.5 hover:bg-primary/15 text-primary"
                          aria-label={`Accept tag ${s.name}`}
                          data-testid={`accept-suggested-tag-${s.name}`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDismissTagSuggestion(s.name)}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/15 text-muted-foreground"
                          aria-label={`Dismiss tag ${s.name}`}
                          data-testid={`dismiss-suggested-tag-${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Collections
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]" data-testid="photo-collections">
                {photo.photoCollections?.map((col) => (
                  <Badge key={col.id} variant="outline" className="gap-1 pr-1">
                    <Link href={`/collections/${col.id}`} className="hover:underline">
                      {col.title}
                    </Link>
                    <button
                      onClick={() => handleRemoveFromCollection(col.id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                      data-testid={`remove-collection-${col.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!photo.photoCollections || photo.photoCollections.length === 0) && (
                  <span className="text-xs text-muted-foreground">Not in any collection</span>
                )}
              </div>
              {availableCollections && availableCollections.length > 0 && (
                <Select onValueChange={handleAddCollection} data-testid="add-collection-select">
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder="Add to collection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCollections.map((col) => (
                      <SelectItem key={col.id} value={String(col.id)} data-testid={`collection-option-${col.id}`}>
                        {col.title}
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
