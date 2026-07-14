import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Star, FolderOpen, FolderKanban, Loader2, ExternalLink, ChevronLeft, ChevronRight, Download, EyeOff, Eye, Check, Plus, ImageIcon, ImageOff, Bot, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  useGetPhoto,
  useListCollections,
  useAddPhotoToCollection,
  useRemovePhotoFromCollection,
  useUpdatePhoto,
  useRatePhoto,
  useClearPhotoRating,
  useGetMe,
  useCreateCollection,
  useSetAlbumCover,
  useDeletePhoto,
  useListProjects,
  useAddPhotoToProject,
  useRemovePhotoFromProject,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
  getListPhotosQueryKey,
  getGetRecentPhotosQueryKey,
  getGetTopRatedPhotosQueryKey,
  getListCollectionsQueryKey,
  getListProjectsQueryKey,
  getGetProjectQueryKey,
  getGetAlbumQueryKey,
  getListAlbumsQueryKey,
} from "@workspace/api-client-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { FadeImage } from "@/components/ui/fade-image";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { tokenize, suggestCollections } from "@/lib/aiSuggestions";

export interface LightboxPhoto {
  id: number;
  url: string;
  thumbnailKey?: string | null;
  name?: string | null;
  averageRating?: number | null;
  albumId?: number | null;
}

interface PhotoLightboxProps {
  photo: LightboxPhoto | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isLoadingNext?: boolean;
  albumId?: number | null;
  coverPhotoId?: number | null;
  onDeleted?: (photoId: number) => void;
}

function LightboxStarRating({
  photoId,
  myRating,
  averageRating,
  currentUserId,
  onRated,
  onAdvance,
}: {
  photoId: number;
  myRating?: number | null;
  averageRating?: number | null;
  currentUserId?: number;
  onRated: () => void;
  onAdvance?: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const { mutate: ratePhoto, isPending } = useRatePhoto();
  const { mutate: clearRating, isPending: isClearing } = useClearPhotoRating();
  const { toast } = useToast();

  const isSignedIn = currentUserId != null;
  const displayRating = hovered || myRating || 0;

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
          onAdvance?.();
        },
        onError: () => toast({ title: "Failed to submit rating", variant: "destructive" }),
      }
    );
  }

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

  return (
    <div className="space-y-2" data-testid="lightbox-rating-section">
      <div className="flex items-center gap-1.5 text-white/70">
        <Star className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Rate this photo</span>
      </div>

      {averageRating != null && (
        <div className="flex items-center gap-1 text-xs text-white/60" data-testid="lightbox-average-rating">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-amber-400 font-semibold">{averageRating.toFixed(1)}</span>
          <span className="text-white/40">avg</span>
        </div>
      )}

      <div className="flex items-center gap-0.5" data-testid="lightbox-star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => isSignedIn && setHovered(star)}
            onMouseLeave={() => isSignedIn && setHovered(0)}
            disabled={isPending || isClearing || !isSignedIn}
            aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
            aria-pressed={myRating === star}
            data-testid={`lightbox-star-${star}`}
            className={cn(
              "p-0.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-amber-400",
              isSignedIn
                ? "hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                : "cursor-not-allowed opacity-50"
            )}
          >
            <Star
              className={
                displayRating >= star
                  ? "h-5 w-5 fill-amber-400 text-amber-400"
                  : "h-5 w-5 text-white/40 stroke-[1.75]"
              }
            />
          </button>
        ))}
        {myRating != null && (
          <span className="text-xs text-white/60 ml-1.5" data-testid="lightbox-my-rating">
            {myRating}/5
          </span>
        )}
      </div>

      {isSignedIn && myRating != null && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending || isClearing}
          className="text-xs text-white/50 hover:text-white/80 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          data-testid="lightbox-clear-rating"
        >
          Clear rating
        </button>
      )}

      {!isSignedIn && (
        <p className="text-xs text-white/40">Sign in to rate photos.</p>
      )}
    </div>
  );
}

function PhotoSidebarContent({
  photoId,
  albumId,
  coverAlbumId,
  coverPhotoId,
  onAdvance,
  onCoverSet,
  onDeleted,
}: {
  photoId: number;
  albumId?: number | null;
  coverAlbumId?: number | null;
  coverPhotoId?: number | null;
  onAdvance?: () => void;
  onCoverSet?: (photoId: number) => void;
  onDeleted?: (photoId: number) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: fullPhoto, isLoading: photoLoading } = useGetPhoto(photoId, {
    query: { queryKey: getGetPhotoQueryKey(photoId) },
  });
  const { data: allCollections, isLoading: collectionsLoading } = useListCollections();
  const { mutate: addToCollection, isPending: adding } = useAddPhotoToCollection();
  const { mutate: removeFromCollection, isPending: removing } = useRemovePhotoFromCollection();
  const { mutate: updatePhoto, isPending: updatingVisibility } = useUpdatePhoto();
  const { mutate: createCollection, isPending: creating } = useCreateCollection();
  const { mutate: setAlbumCover, isPending: settingCover } = useSetAlbumCover();
  const { mutate: deletePhoto, isPending: deleting } = useDeletePhoto();
  const { data: allProjects } = useListProjects();
  const { mutate: addToProject, isPending: addingToProject } = useAddPhotoToProject();
  const { mutate: removeFromProject, isPending: removingFromProject } = useRemovePhotoFromProject();
  const { data: me } = useGetMe();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const newTitleRef = useRef<HTMLInputElement>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId) });
    }
    qc.invalidateQueries({ queryKey: getListPhotosQueryKey().slice(0, 1) });
    qc.invalidateQueries({ queryKey: getGetRecentPhotosQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
    qc.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
  }

  function handleAdd(collectionId: string) {
    addToCollection(
      { id: parseInt(collectionId, 10), data: { photoId } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Added to collection" });
        },
        onError: () => toast({ title: "Failed to add to collection", variant: "destructive" }),
      }
    );
  }

  function handleAddProject(projectId: number, projectName: string) {
    addToProject(
      { id: projectId, data: { photoId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: `Added to "${projectName}"` });
        },
        onError: () => toast({ title: "Failed to add to project", variant: "destructive" }),
      }
    );
  }

  function handleRemoveProject(projectId: number, projectName: string) {
    removeFromProject(
      { id: projectId, photoId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: `Removed from "${projectName}"` });
        },
        onError: () => toast({ title: "Failed to remove from project", variant: "destructive" }),
      }
    );
  }

  function handleRemove(collectionId: number, collectionTitle: string) {
    removeFromCollection(
      { id: collectionId, photoId },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `Removed from "${collectionTitle}"` });
        },
        onError: () => toast({ title: "Failed to remove from collection", variant: "destructive" }),
      }
    );
  }

  function handleToggleHidden() {
    const next = !fullPhoto?.isHidden;
    updatePhoto(
      { id: photoId, data: { isHidden: next } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: next ? "Photo hidden" : "Photo visible again" });
          if (next) onAdvance?.();
        },
        onError: () => toast({ title: "Failed to update photo", variant: "destructive" }),
      }
    );
  }

  function handleSetCover() {
    if (!coverAlbumId) return;
    setAlbumCover(
      { id: coverAlbumId, data: { photoId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAlbumQueryKey(coverAlbumId) });
          qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
          onCoverSet?.(photoId);
          toast({ title: "Cover photo updated" });
        },
        onError: () => toast({ title: "Failed to set cover photo", variant: "destructive" }),
      }
    );
  }

  function openNewForm() {
    setShowNewForm(true);
    setNewTitle("");
    setNewDesc("");
    setTimeout(() => newTitleRef.current?.focus(), 0);
  }

  function cancelNewForm() {
    setShowNewForm(false);
    setNewTitle("");
    setNewDesc("");
  }

  function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;
    createCollection(
      { data: { title: trimmedTitle, description: newDesc.trim() || undefined } },
      {
        onSuccess: (newCollection) => {
          fetch(`/api/collections/${newCollection.id}/generate-keywords`, { method: "POST" }).catch(() => {});
          addToCollection(
            { id: newCollection.id, data: { photoId } },
            {
              onSuccess: () => {
                invalidate();
                toast({ title: `Created "${trimmedTitle}" and added photo` });
                cancelNewForm();
              },
              onError: () => {
                invalidate();
                toast({ title: `Collection "${trimmedTitle}" created, but couldn't add photo`, variant: "destructive" });
                cancelNewForm();
              },
            }
          );
        },
        onError: () => toast({ title: "Failed to create collection", variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    deletePhoto(
      { id: photoId },
      {
        onSuccess: () => {
          toast({ title: "Photo deleted" });
          if (albumId) {
            qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId) });
          }
          qc.invalidateQueries({ queryKey: getListPhotosQueryKey().slice(0, 1) });
          qc.invalidateQueries({ queryKey: getGetRecentPhotosQueryKey() });
          qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
          onDeleted?.(photoId);
        },
        onError: () => toast({ title: "Failed to delete photo", variant: "destructive" }),
      }
    );
  }

  const currentCollections = fullPhoto?.photoCollections ?? [];
  const currentProjects = fullPhoto?.photoProjects ?? [];
  const isHidden = fullPhoto?.isHidden ?? false;
  const canDelete = me && fullPhoto && (me.id === fullPhoto.uploaderId || me.role === "admin");

  if (photoLoading || collectionsLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
      </div>
    );
  }

  const isCover = coverPhotoId != null && coverPhotoId === photoId;

  return (
    <div className="space-y-4" data-testid="lightbox-collection-manager">
      {coverAlbumId != null && (
        <button
          type="button"
          onClick={handleSetCover}
          disabled={isCover || settingCover}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
            isCover
              ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 opacity-80"
              : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 disabled:opacity-50"
          )}
          data-testid="lightbox-set-cover-btn"
        >
          {settingCover ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4 shrink-0" />
          )}
          {isCover ? "Current cover" : "Set as cover"}
        </button>
      )}

      {me?.role === "admin" && (
        <button
          type="button"
          onClick={handleToggleHidden}
          disabled={updatingVisibility}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
            isHidden
              ? "bg-amber-500/20 border-amber-400/40 text-amber-300 hover:bg-amber-500/30"
              : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
          )}
          data-testid="lightbox-toggle-hidden"
        >
          {isHidden ? <Eye className="h-4 w-4 shrink-0" /> : <EyeOff className="h-4 w-4 shrink-0" />}
          {isHidden ? "Unhide photo" : "Hide photo"}
        </button>
      )}

      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={deleting}
              className="flex items-center gap-2 w-full rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="lightbox-delete-btn"
            >
              {deleting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="h-4 w-4 shrink-0" />}
              Delete photo
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the photo from all albums and collections. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="lightbox-confirm-delete"
              >
                Delete photo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="border-t border-white/10 pt-3">
        <LightboxStarRating
          photoId={photoId}
          myRating={fullPhoto?.myRating}
          averageRating={fullPhoto?.averageRating}
          currentUserId={me?.id}
          onRated={invalidate}
          onAdvance={onAdvance}
        />
      </div>

      {fullPhoto?.aiDescription && (
        <div className="border-t border-white/10 pt-3 space-y-1.5" data-testid="lightbox-ai-description">
          <div className="flex items-center gap-1.5 text-white/70">
            <Bot className="h-3.5 w-3.5 text-sky-300" />
            <span className="text-xs font-semibold uppercase tracking-wide">AI Description</span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">{fullPhoto.aiDescription}</p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-white/70">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Collections</span>
          </div>
          {!showNewForm && (
            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-0.5 text-xs text-white/50 hover:text-white/90 transition-colors rounded px-1 py-0.5 hover:bg-white/10"
              data-testid="lightbox-new-collection-btn"
              aria-label="Create new collection"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          )}
        </div>

        {showNewForm && (
          <form
            onSubmit={handleCreateAndAdd}
            className="space-y-2 rounded-lg border border-white/20 bg-white/5 p-2.5"
            data-testid="lightbox-new-collection-form"
          >
            <input
              ref={newTitleRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Collection title"
              required
              className="w-full rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/35 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/40"
              data-testid="lightbox-new-collection-title"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/35 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/40"
              data-testid="lightbox-new-collection-desc"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={creating || adding || !newTitle.trim()}
                className="flex-1 rounded-md bg-white text-gray-900 text-xs font-medium px-2.5 py-1.5 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="lightbox-new-collection-submit"
              >
                {creating || adding ? (
                  <span className="flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Creating…
                  </span>
                ) : (
                  "Create & add"
                )}
              </button>
              <button
                type="button"
                onClick={cancelNewForm}
                className="rounded-md border border-white/20 text-white/60 text-xs px-2.5 py-1.5 hover:bg-white/10 hover:text-white transition-colors"
                data-testid="lightbox-new-collection-cancel"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {allCollections && allCollections.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="lightbox-collection-pills">
            {(() => {
              const suggested = suggestCollections(fullPhoto?.aiDescription, allCollections);
              const sorted = [...allCollections].sort((a, b) => {
                const aS = suggested.has(a.id) ? 0 : 1;
                const bS = suggested.has(b.id) ? 0 : 1;
                return aS - bS;
              });
              return sorted.map((col) => {
                const isIn = currentCollections.some((c) => c.id === col.id);
                const isSuggested = suggested.has(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      isIn ? handleRemove(col.id, col.title) : handleAdd(String(col.id))
                    }
                    disabled={adding || removing}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50",
                      isIn
                        ? "bg-white text-gray-900 border border-white hover:bg-white/85"
                        : isSuggested
                        ? "bg-amber-500/20 text-amber-200 border border-amber-400/50 hover:bg-amber-500/35 hover:text-amber-100 hover:border-amber-400/80"
                        : "bg-transparent text-white/65 border border-white/30 hover:bg-white/10 hover:text-white hover:border-white/50"
                    )}
                    data-testid={`lightbox-collection-pill-${col.id}`}
                    aria-label={
                      isIn
                        ? `Remove from ${col.title}`
                        : isSuggested
                        ? `AI suggested: Add to ${col.title}`
                        : `Add to ${col.title}`
                    }
                    aria-pressed={isIn}
                    title={isSuggested && !isIn ? "AI suggested based on photo description" : undefined}
                  >
                    {isIn ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : isSuggested ? (
                      <Sparkles className="h-3 w-3 shrink-0" />
                    ) : (
                      <Plus className="h-3 w-3 shrink-0" />
                    )}
                    {col.title}
                  </button>
                );
              });
            })()}
          </div>
        ) : !showNewForm ? (
          <p className="text-xs text-white/40">No collections yet.</p>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center gap-1.5 text-white/70">
          <FolderKanban className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Projects</span>
        </div>

        {allProjects && allProjects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="lightbox-project-pills">
            {allProjects.map((proj) => {
              const isIn = currentProjects.some((p) => p.id === proj.id);
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() =>
                    isIn ? handleRemoveProject(proj.id, proj.name) : handleAddProject(proj.id, proj.name)
                  }
                  disabled={addingToProject || removingFromProject}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50",
                    isIn
                      ? "bg-white text-gray-900 border border-white hover:bg-white/85"
                      : "bg-transparent text-white/65 border border-white/30 hover:bg-white/10 hover:text-white hover:border-white/50"
                  )}
                  data-testid={`lightbox-project-pill-${proj.id}`}
                  aria-label={isIn ? `Remove from ${proj.name}` : `Add to ${proj.name}`}
                  aria-pressed={isIn}
                >
                  {isIn ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0" />}
                  {proj.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/40">No projects yet.</p>
        )}
      </div>
    </div>
  );
}

const SWIPE_THRESHOLD = 50;

export function PhotoLightbox({ photo, onClose, onPrev, onNext, hasPrev, hasNext, isLoadingNext, albumId, coverPhotoId, onDeleted }: PhotoLightboxProps) {
  const imgSrc = photo?.url ?? undefined;
  const touchStartX = useRef<number | null>(null);
  const qc = useQueryClient();
  const { mutate: ratePhotoKb } = useRatePhoto();

  const [localCoverPhotoId, setLocalCoverPhotoId] = useState<number | null | undefined>(coverPhotoId);
  useEffect(() => {
    setLocalCoverPhotoId(coverPhotoId);
  }, [coverPhotoId]);

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  useLayoutEffect(() => {
    if (photo?.id != null) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [photo?.id]);

  const handleAdvance = useCallback(() => {
    if (hasNext && onNext) onNext();
  }, [hasNext, onNext]);

  const { mutate: updatePhotoKb } = useUpdatePhoto();
  const { data: me } = useGetMe();
  const { toast: toastKb } = useToast();

  // Stable refs so keydown listeners always call the latest version
  const hideAndAdvanceRef = useRef<() => void>(() => {});
  hideAndAdvanceRef.current = useCallback(() => {
    if (!photo || me?.role !== "admin") return;
    updatePhotoKb(
      { id: photo.id, data: { isHidden: true } },
      {
        onSuccess: () => {
          toastKb({ title: "Photo hidden" });
          handleAdvance();
        },
      },
    );
  }, [photo, me, updatePhotoKb, toastKb, handleAdvance]);

  const rateAndAdvanceRef = useRef<(score: number) => void>(() => {});
  rateAndAdvanceRef.current = useCallback((score: number) => {
    if (!photo) return;
    ratePhotoKb(
      { id: photo.id, data: { score } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photo.id) });
          qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
          handleAdvance();
        },
      }
    );
  }, [photo, ratePhotoKb, qc, handleAdvance]);

  useEffect(() => {
    if (!photo) return;
    function handleKey(e: KeyboardEvent) {
      // Don't hijack keystrokes while the user is typing in a field (e.g. naming
      // a new collection) — otherwise arrow keys change photo, digits rate it,
      // and "h" hides it, all while they mean to be entering text.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      } else if ((e.key === "h" || e.key === "H") && me?.role === "admin") {
        e.preventDefault();
        hideAndAdvanceRef.current();
      } else {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 5) {
          e.preventDefault();
          rateAndAdvanceRef.current(digit);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photo, hasPrev, hasNext, onPrev, onNext]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0 && hasNext && onNext) {
      onNext();
    } else if (deltaX > 0 && hasPrev && onPrev) {
      onPrev();
    }
  }

  return (
    <DialogPrimitive.Root open={photo !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          onClick={onClose}
        />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          data-testid="photo-lightbox"
          aria-label={photo?.name ?? "Photo preview"}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogPrimitive.Title className="sr-only">
            {photo?.name ?? "Photo preview"}
          </DialogPrimitive.Title>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10"
            aria-label="Close preview"
            data-testid="lightbox-close"
          >
            <X className="h-5 w-5" />
          </button>

          {onPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              disabled={!hasPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous photo"
              data-testid="lightbox-prev"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {onNext && (
            <button
              onClick={(e) => { e.stopPropagation(); if (!isLoadingNext) onNext(); }}
              disabled={!hasNext || isLoadingNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next photo"
              data-testid="lightbox-next"
            >
              {isLoadingNext ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ChevronRight className="h-6 w-6" />
              )}
            </button>
          )}

          {photo && (
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 max-w-6xl w-full max-h-[90vh]">
              <div className="flex-1 flex flex-col items-center gap-3 min-w-0 overflow-hidden">
                <div className="relative flex items-center justify-center max-h-[65vh] lg:max-h-[80vh] w-full">
                  {imageLoading && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <Loader2 className="h-10 w-10 text-white/60 animate-spin" />
                    </div>
                  )}
                  {imageError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 text-white/60" data-testid="lightbox-image-error">
                      <ImageOff className="h-10 w-10" />
                      <span className="text-sm">Failed to load image</span>
                    </div>
                  )}
                  <FadeImage
                    key={photo.id}
                    src={imgSrc!}
                    alt={photo.name ?? "Photo"}
                    fit="contain"
                    className="max-h-[65vh] lg:max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                    data-testid="lightbox-image"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {photo.name && (
                    <span className="text-white font-medium text-sm" data-testid="lightbox-name">
                      {photo.name}
                    </span>
                  )}
                  {photo.averageRating != null && (
                    <div className="flex items-center gap-1" data-testid="lightbox-rating">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-amber-400 font-semibold text-sm">
                        {photo.averageRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div
                className="lg:w-64 shrink-0 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-4 space-y-3 lg:max-h-[85vh] lg:overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                data-testid="lightbox-sidebar"
              >
                <Link
                  href={`/photos/${photo.id}`}
                  onClick={onClose}
                  className="flex items-center gap-2 w-full rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors"
                  data-testid="lightbox-view-details-link"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  View full details
                </Link>

                <a
                  href={photo.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 w-full rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors"
                  data-testid="lightbox-download"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Download
                </a>

                <div className="border-t border-white/10 pt-3">
                  <PhotoSidebarContent
                    photoId={photo.id}
                    albumId={photo.albumId}
                    coverAlbumId={albumId}
                    coverPhotoId={localCoverPhotoId}
                    onAdvance={handleAdvance}
                    onCoverSet={(newCoverId) => setLocalCoverPhotoId(newCoverId)}
                    onDeleted={(deletedId) => { onDeleted?.(deletedId); onClose(); }}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
