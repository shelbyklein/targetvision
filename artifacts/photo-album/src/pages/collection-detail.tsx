import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetCollection,
  useUpdateCollection,
  useDeleteCollection,
  getGetCollectionQueryKey,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowLeft, FolderOpen, Pencil, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function RenameCollectionDialog({
  collectionId,
  currentTitle,
  currentDescription,
  onUpdated,
}: {
  collectionId: number;
  currentTitle: string;
  currentDescription?: string | null;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription ?? "");
  const { mutate: updateCollection, isPending } = useUpdateCollection();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    updateCollection(
      {
        id: collectionId,
        data: {
          title: title.trim(),
          description: description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          onUpdated();
          toast({ title: "Collection updated" });
        },
        onError: () => toast({ title: "Failed to update collection", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="rename-collection-btn">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="rename-title">Title *</Label>
            <Input
              id="rename-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-testid="rename-title-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rename-desc">Description</Label>
            <Textarea
              id="rename-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              data-testid="rename-desc-input"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()} data-testid="rename-submit">
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const collectionId = parseInt(id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: collection, isLoading } = useGetCollection(collectionId, {
    query: { enabled: !!collectionId, queryKey: getGetCollectionQueryKey(collectionId) },
  });
  const { data: me } = useGetMe();
  const { mutate: deleteCollection, isPending: deletingCollection } = useDeleteCollection();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
    qc.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
  }

  function handleDeleteCollection() {
    deleteCollection(
      { id: collectionId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
          toast({ title: "Collection deleted" });
          navigate("/collections");
        },
        onError: () => toast({ title: "Failed to delete collection", variant: "destructive" }),
      }
    );
  }

  const canManage =
    me && collection && (me.id === collection.createdById || me.role === "admin");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!collection) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">Collection not found.</p>
          <Link href="/collections">
            <Button variant="outline" className="mt-4">
              Back to Collections
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="collection-detail-page">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/collections">
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0"
                data-testid="back-to-collections"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="collection-title">
                {collection.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {collection.photoCount} photo{collection.photoCount !== 1 ? "s" : ""}
                              </p>
              {collection.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                  {collection.description}
                </p>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <RenameCollectionDialog
                collectionId={collectionId}
                currentTitle={collection.title}
                currentDescription={collection.description}
                onUpdated={invalidate}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="delete-collection-btn"
                    title="Delete collection"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{collection.title}". The photos themselves will
                      not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteCollection}
                      disabled={deletingCollection}
                      className="bg-destructive hover:bg-destructive/90"
                      data-testid="confirm-delete-collection"
                    >
                      {deletingCollection ? "Deleting…" : "Delete Collection"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {!collection.photos || collection.photos.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl"
            data-testid="no-collection-photos"
          >
            <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No photos yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Open a photo's detail page and add it to this collection from the Collections section.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            data-testid="collection-photo-grid"
          >
            {collection.photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-lg overflow-hidden bg-muted"
                data-testid="collection-photo-item"
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
                    <p className="text-xs font-medium text-foreground truncate">{photo.caption}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic truncate">No caption</p>
                  )}
                </div>

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 pointer-events-none" />

                {photo.averageRating != null && (
                  <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-white font-medium">
                      {photo.averageRating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
