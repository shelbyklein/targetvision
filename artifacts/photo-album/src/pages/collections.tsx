import { useState } from "react";
import { Link } from "wouter";
import {
  useListCollections,
  useCreateCollection,
  getListCollectionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Plus, FolderOpen, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CreateCollectionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { mutate: createCollection, isPending } = useCreateCollection();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createCollection(
      { data: { title: title.trim(), description: description.trim() || undefined } },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setDescription("");
          onCreated();
          toast({ title: "Collection created", description: `"${title}" is ready.` });
        },
        onError: () => toast({ title: "Failed to create collection", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="create-collection-btn">
          <Plus className="h-4 w-4" />
          New Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="collection-title">Title *</Label>
            <Input
              id="collection-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Youth Division"
              required
              data-testid="collection-title-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="collection-desc">Description</Label>
            <Textarea
              id="collection-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this collection..."
              rows={3}
              data-testid="collection-desc-input"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !title.trim()}
              data-testid="create-collection-submit"
            >
              {isPending ? "Creating..." : "Create Collection"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Collections() {
  const qc = useQueryClient();
  const { data: collections, isLoading } = useListCollections();

  function refetch() {
    qc.invalidateQueries({ queryKey: getListCollectionsQueryKey() });
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="collections-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Collections</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {collections?.length ?? 0} collection{collections?.length !== 1 ? "s" : ""} — group photos across albums by subject or context
            </p>
          </div>
          <CreateCollectionDialog onCreated={refetch} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : collections && collections.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="collections-grid">
            {collections.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.id}`}>
                <div
                  className="rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:shadow-md transition-shadow"
                  data-testid="collection-card"
                >
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {collection.coverPhotoUrl ? (
                      <img
                        src={collection.coverPhotoUrl}
                        alt={collection.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                        <FolderOpen className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-foreground text-sm truncate">{collection.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {collection.photoCount} photo{collection.photoCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {collection.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {collection.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-24 text-center"
            data-testid="collections-empty"
          >
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No collections yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create a collection to group photos by subject or context across multiple albums.
            </p>
            <CreateCollectionDialog onCreated={refetch} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
