import { useState } from "react";
import { Link } from "wouter";
import { useListAlbums, useCreateAlbum, getListAlbumsQueryKey } from "@workspace/api-client-react";
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
import { Plus, Images, CalendarDays, Camera, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";

function CreateAlbumDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const { mutate: createAlbum, isPending } = useCreateAlbum();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createAlbum(
      { data: { title: title.trim(), description: description.trim() || undefined, eventDate: eventDate || undefined } },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setDescription("");
          setEventDate("");
          onCreated();
          toast({ title: "Album created", description: `"${title}" is ready.` });
        },
        onError: () => toast({ title: "Failed to create album", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="create-album-btn">
          <Plus className="h-4 w-4" />
          New Album
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Album</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="album-title">Title *</Label>
            <Input
              id="album-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summer Offsite 2025"
              required
              data-testid="album-title-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="album-desc">Description</Label>
            <Textarea
              id="album-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this album..."
              rows={3}
              data-testid="album-desc-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="album-date">Event Date</Label>
            <Input
              id="album-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              data-testid="album-date-input"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !title.trim()} data-testid="create-album-submit">
              {isPending ? "Creating..." : "Create Album"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Albums() {
  const qc = useQueryClient();
  const { data: albums, isLoading } = useListAlbums();
  const { data: me } = useGetMe();

  function refetch() {
    qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="albums-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Albums</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {albums?.length ?? 0} album{albums?.length !== 1 ? "s" : ""} ready to review
            </p>
          </div>
          <CreateAlbumDialog onCreated={refetch} />
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
        ) : albums && albums.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="albums-grid">
            {albums.map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`}>
                <div className="rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:shadow-md transition-shadow" data-testid="album-card">
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {album.coverPhotoUrl ? (
                      <img
                        src={album.coverPhotoThumbnailKey ? `/api/storage${album.coverPhotoThumbnailKey}` : album.coverPhotoUrl}
                        alt={album.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                        <Images className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-foreground text-sm truncate">{album.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {album.photoCount} photo{album.photoCount !== 1 ? "s" : ""}
                      </span>
                      {me?.role === "admin" && !!album.hiddenCount && (
                        <span className="flex items-center gap-0.5 text-muted-foreground/70">
                          <EyeOff className="h-3 w-3" />
                          {album.hiddenCount} hidden
                        </span>
                      )}
                      {album.eventDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {album.eventDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="albums-empty">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Images className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No albums yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create your first album to start gathering photos for the team to review.
            </p>
            <CreateAlbumDialog onCreated={refetch} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
