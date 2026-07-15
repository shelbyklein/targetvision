import { FolderOpen, FolderKanban, Loader2, EyeOff, Eye, Check, Plus, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  useGetPhoto,
  useListCollections,
  useAddPhotoToCollection,
  useRemovePhotoFromCollection,
  useUpdatePhoto,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { suggestCollections } from "@/lib/aiSuggestions";
import { LightboxStarRating } from "./LightboxStarRating";

export function PhotoSidebarContent({
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
