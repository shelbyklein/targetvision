import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPhoto,
  useListAlbumPhotos,
  useRatePhoto,
  useClearPhotoRating,
  useDeletePhoto,
  useListCollections,
  useAddPhotoToCollection,
  useRemovePhotoFromCollection,
  useAcceptPhotoSuggestion,
  useDismissPhotoSuggestion,
  useAcceptPhotoNewCollectionSuggestion,
  useDismissPhotoNewCollectionSuggestion,
  useRerunPhotoAnalysis,
  useUpdatePhoto,
  useCreateCollection,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
  getListPhotosQueryKey,
  getGetRecentPhotosQueryKey,
  getGetTopRatedPhotosQueryKey,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, X, ArrowLeft, Trash2, CalendarDays, Download, FolderOpen, Sparkles, Check, Loader2, RefreshCw, ChevronLeft, ChevronRight, Pencil, Plus, EyeOff, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const { data: allCollections } = useListCollections();
  const { mutate: addToCollection } = useAddPhotoToCollection();
  const { mutate: removeFromCollection } = useRemovePhotoFromCollection();
  const { mutate: acceptSuggestion } = useAcceptPhotoSuggestion();
  const { mutate: dismissSuggestion } = useDismissPhotoSuggestion();
  const { mutate: acceptNewCollectionSuggestion, isPending: acceptingNewCollection } = useAcceptPhotoNewCollectionSuggestion();
  const { mutate: dismissNewCollectionSuggestion } = useDismissPhotoNewCollectionSuggestion();
  const { mutate: deletePhoto, isPending: deleting } = useDeletePhoto();
  const { mutate: rerunAnalysis, isPending: rerunning } = useRerunPhotoAnalysis();
  const { mutate: updatePhoto, isPending: savingDescription } = useUpdatePhoto();
  const { mutate: createCollection, isPending: creatingCollection } = useCreateCollection();
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [confirmNewCollection, setConfirmNewCollection] = useState<{
    suggestionId: number;
    name: string;
  } | null>(null);

  const { data: albumPhotos } = useListAlbumPhotos(photo?.albumId ?? 0, {
    query: { enabled: !!photo?.albumId },
  });

  const currentIndex = albumPhotos ? albumPhotos.findIndex((p) => p.id === photoId) : -1;
  const prevPhotoId = currentIndex > 0 ? albumPhotos![currentIndex - 1].id : null;
  const nextPhotoId = currentIndex >= 0 && albumPhotos && currentIndex < albumPhotos.length - 1 ? albumPhotos![currentIndex + 1].id : null;

  useEffect(() => {
    setEditingDescription(false);
    setDescriptionDraft("");
  }, [photoId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (!target) return;
      const tag = (target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((target as HTMLElement).isContentEditable) return;
      if (target.closest('[role="listbox"], [role="menu"], [role="dialog"], [role="combobox"]')) return;
      if (e.key === "ArrowLeft" && prevPhotoId != null) {
        e.preventDefault();
        navigate(`/photos/${prevPhotoId}`);
      } else if (e.key === "ArrowRight" && nextPhotoId != null) {
        e.preventDefault();
        navigate(`/photos/${nextPhotoId}`);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prevPhotoId, nextPhotoId, navigate]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (photo?.albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(photo.albumId) });
    }
    qc.invalidateQueries({ queryKey: getListPhotosQueryKey().slice(0, 1) });
    qc.invalidateQueries({ queryKey: getGetRecentPhotosQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
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

  function handleAcceptNewCollectionSuggestion(suggestionId: number, name: string) {
    acceptNewCollectionSuggestion(
      { id: photoId, suggestionId, data: { name } },
      {
        onSuccess: () => {
          setConfirmNewCollection(null);
          invalidate();
          qc.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          toast({ title: "Collection created and photo added" });
        },
        onError: () => toast({ title: "Failed to accept suggestion", variant: "destructive" }),
      }
    );
  }

  function handleDismissNewCollectionSuggestion(suggestionId: number) {
    dismissNewCollectionSuggestion(
      { id: photoId, suggestionId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to dismiss suggestion", variant: "destructive" }) }
    );
  }

  function handleAddCollection(collectionId: string) {
    addToCollection(
      { id: parseInt(collectionId, 10), data: { photoId } },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to add to collection", variant: "destructive" }) }
    );
  }

  function handleCreateNewCollection(e: React.FormEvent) {
    e.preventDefault();
    const name = newCollectionName.trim();
    if (!name) return;
    createCollection(
      { data: { title: name } },
      {
        onSuccess: (newCol) => {
          setNewCollectionName("");
          qc.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          addToCollection(
            { id: newCol.id, data: { photoId } },
            {
              onSuccess: () => {
                invalidate();
                toast({ title: `Added to "${name}"` });
              },
              onError: () => toast({ title: "Collection created but failed to add photo", variant: "destructive" }),
            }
          );
        },
        onError: () => toast({ title: "Failed to create collection", variant: "destructive" }),
      }
    );
  }

  function handleRemoveFromCollection(collectionId: number) {
    removeFromCollection(
      { id: collectionId, photoId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to remove from collection", variant: "destructive" }) }
    );
  }

  function deriveFilename(url: string, fallbackId?: number): string {
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

    function sanitize(n: string): string {
      return n
        .trim()
        .replace(/[^a-zA-Z0-9-_ ]+/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
    }

    const cleanedUrlBase = urlBase ? sanitize(urlBase) : "";
    const base = cleanedUrlBase || `photo-${fallbackId ?? "image"}`;
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
    const filename = deriveFilename(photo.url, photo.id);
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

  function handleRerunAnalysis() {
    rerunAnalysis(
      { id: photoId },
      {
        onSuccess: () => {
          toast({ title: "AI analysis started" });
          qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
        },
        onError: () => toast({ title: "Failed to start AI analysis", variant: "destructive" }),
      }
    );
  }

  function handleStartEditDescription() {
    setDescriptionDraft(photo?.aiDescription ?? "");
    setEditingDescription(true);
  }

  function handleCancelEditDescription() {
    setEditingDescription(false);
    setDescriptionDraft("");
  }

  function handleSaveDescription() {
    updatePhoto(
      { id: photoId, data: { aiDescription: descriptionDraft.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Description saved" });
          setEditingDescription(false);
          setDescriptionDraft("");
          qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
        },
        onError: () => toast({ title: "Failed to save description", variant: "destructive" }),
      }
    );
  }

  const availableCollections = allCollections?.filter(
    (col) => !photo?.photoCollections?.some((c) => c.id === col.id)
  );

  const canDelete = me && photo && (me.id === photo.uploaderId || me.role === "admin");
  const canRerunAnalysis = me && photo && (me.id === photo.uploaderId || me.role === "admin");
  const canEditDescription = me && photo && (me.id === photo.uploaderId || me.role === "admin");
  const canToggleHidden = me && photo && (me.id === photo.uploaderId || me.role === "admin");

  function handleToggleHidden() {
    if (!photo) return;
    const next = !photo.isHidden;
    updatePhoto(
      { id: photoId, data: { isHidden: next } },
      {
        onSuccess: () => {
          toast({ title: next ? "Photo hidden" : "Photo visible again" });
          invalidate();
        },
        onError: () => toast({ title: "Failed to update photo", variant: "destructive" }),
      }
    );
  }

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
        <div className="flex items-center justify-between gap-3">
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
          {photo.albumId && (
            <div className="flex items-center gap-1" data-testid="photo-nav">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={prevPhotoId == null}
                onClick={() => prevPhotoId != null && navigate(`/photos/${prevPhotoId}`)}
                aria-label="Previous photo"
                data-testid="prev-photo-btn"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              {albumPhotos && currentIndex >= 0 && (
                <span className="text-xs text-muted-foreground px-1 tabular-nums" data-testid="photo-position">
                  {currentIndex + 1} / {albumPhotos.length}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={nextPhotoId == null}
                onClick={() => nextPhotoId != null && navigate(`/photos/${nextPhotoId}`)}
                aria-label="Next photo"
                data-testid="next-photo-btn"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-muted aspect-[4/3]">
              <img
                src={photo.url}
                alt="Photo"
                className={`h-full w-full object-contain bg-black${photo.isHidden ? " opacity-60" : ""}`}
                data-testid="photo-image"
              />
              {photo.isHidden && (
                <div
                  className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1"
                  data-testid="photo-hidden-badge"
                >
                  <EyeOff className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs font-semibold text-white">Hidden</span>
                </div>
              )}
            </div>
            <div
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-2"
              data-testid="ai-description-block"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI description
                </div>
                <div className="flex items-center gap-2">
                  {canEditDescription && !editingDescription && (
                    <button
                      type="button"
                      onClick={handleStartEditDescription}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="edit-description-btn"
                      title="Edit description"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                  {canRerunAnalysis && !editingDescription && (
                    <button
                      type="button"
                      onClick={handleRerunAnalysis}
                      disabled={rerunning}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      data-testid="rerun-analysis-btn"
                      title="Re-run AI analysis"
                    >
                      {rerunning ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
              {editingDescription ? (
                <div className="space-y-2" data-testid="description-edit-form">
                  <Textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="Enter a description…"
                    className="text-sm min-h-[80px] resize-none"
                    disabled={savingDescription}
                    autoFocus
                    data-testid="description-textarea"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={handleSaveDescription}
                      disabled={savingDescription}
                      data-testid="save-description-btn"
                    >
                      {savingDescription ? (
                        <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving…</>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-3"
                      onClick={handleCancelEditDescription}
                      disabled={savingDescription}
                      data-testid="cancel-description-btn"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : photo.aiDescription ? (
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
              {photo.suggestedNewCollections && photo.suggestedNewCollections.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Create new collection
                  </p>
                  <div className="flex flex-wrap gap-1.5" data-testid="suggested-new-collections">
                    {photo.suggestedNewCollections.map((s) => (
                      <div
                        key={s.id}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-50/60 dark:bg-emerald-950/30 pl-2.5 pr-1 py-0.5 text-xs"
                        data-testid={`suggested-new-collection-${s.id}`}
                      >
                        <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-foreground">{s.suggestedName}</span>
                        <button
                          onClick={() => setConfirmNewCollection({ suggestionId: s.id, name: s.suggestedName })}
                          className="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
                          aria-label="Create collection and add photo"
                          title="Create this collection and add photo"
                          data-testid={`accept-new-collection-suggestion-${s.id}`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDismissNewCollectionSuggestion(s.id)}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/15 text-muted-foreground"
                          aria-label="Dismiss suggestion"
                          data-testid={`dismiss-new-collection-suggestion-${s.id}`}
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
              <div className="space-y-1.5 text-sm text-muted-foreground">
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
                        {r.userName ?? `User ${r.userId}`}
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
              <form
                onSubmit={handleCreateNewCollection}
                className="flex gap-1.5"
                data-testid="create-collection-form"
              >
                <Input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name..."
                  className="h-8 text-sm flex-1"
                  disabled={creatingCollection}
                  data-testid="new-collection-name-input"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 px-2.5 gap-1"
                  disabled={creatingCollection || !newCollectionName.trim()}
                  data-testid="create-collection-submit"
                >
                  {creatingCollection ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Create
                </Button>
              </form>
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

            {canToggleHidden && (
              <Button
                variant={photo.isHidden ? "outline" : "outline"}
                size="sm"
                className="gap-2 w-full"
                onClick={handleToggleHidden}
                data-testid="toggle-hidden-btn"
              >
                {photo.isHidden ? (
                  <>
                    <Eye className="h-4 w-4" />
                    Unhide Photo
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide Photo
                  </>
                )}
              </Button>
            )}

            {canDelete && (
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
            )}
          </div>
        </div>
      </div>
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
