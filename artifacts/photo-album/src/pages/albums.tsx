import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FadeImage } from "@/components/ui/fade-image";
import { useListAlbums, useCreateAlbum, useReorderAlbums, getListAlbumsQueryKey } from "@workspace/api-client-react";
import { useCardReorder } from "@/hooks/useCardReorder";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Images, CalendarDays, Camera, EyeOff, FolderInput, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { formatDate } from "@/lib/format-date";

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

// How many album cards to reveal per "page" as the user scrolls (3 rows of the
// 4-column grid). The full list is fetched at once; this just renders a growing
// window so we don't mount every card + cover image up front.
const ALBUMS_PAGE_SIZE = 12;

export default function Albums() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: albums, isLoading } = useListAlbums();
  const { data: me } = useGetMe();
  const [visibleCount, setVisibleCount] = useState(ALBUMS_PAGE_SIZE);

  const totalAlbums = albums?.length ?? 0;
  const visibleAlbums = albums?.slice(0, visibleCount) ?? [];
  const hasMore = totalAlbums > visibleCount;
  const sentinelRef = useInfiniteScroll(
    () => setVisibleCount((c) => c + ALBUMS_PAGE_SIZE),
    hasMore,
  );

  function refetch() {
    qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
  }

  const reorderMutation = useReorderAlbums();
  const reorder = useCardReorder({
    ids: visibleAlbums.map((a) => a.id),
    onCommit: (orderedIds) => {
      // Albums beyond the rendered window keep their relative order after
      // the rearranged visible ones.
      const rest = (albums ?? []).map((a) => a.id).filter((id) => !orderedIds.includes(id));
      reorderMutation.mutate(
        { data: { ids: [...orderedIds, ...rest] } },
        { onSuccess: refetch },
      );
    },
  });

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
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/bulk-upload")} data-testid="bulk-upload-btn">
              <FolderInput className="h-4 w-4" />
              Bulk Upload
            </Button>
            <CreateAlbumDialog onCreated={refetch} />
          </div>
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
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="albums-grid">
            {reorder.arrange(visibleAlbums, (a) => a.id).map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`} {...reorder.handlers(album.id)}>
                <div className={`rounded-xl overflow-hidden border border-border bg-card group cursor-pointer hover:shadow-md transition-shadow${reorder.draggingId === album.id ? " opacity-50" : ""}`} data-testid="album-card">
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {album.coverPhotoUrl ? (
                      <FadeImage
                        src={album.coverPhotoThumbnailKey ? `/api/storage${album.coverPhotoThumbnailKey}` : album.coverPhotoUrl}
                        alt={album.title}
                        loading="lazy"
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
                    {/* Phones show half-width cards, so the stats stack one per
                        line there; two columns only from sm up. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Camera className="h-3 w-3 shrink-0" />
                        {album.photoCount} photo{album.photoCount !== 1 ? "s" : ""}
                      </span>
                      {album.photoCount > 0 && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Star className="h-3 w-3 shrink-0" />
                          {album.ratedCount}/{album.photoCount} rated
                        </span>
                      )}
                      {me?.role === "admin" && !!album.hiddenCount && (
                        <span className="flex items-center gap-0.5 whitespace-nowrap text-muted-foreground/70">
                          <EyeOff className="h-3 w-3 shrink-0" />
                          {album.hiddenCount} hidden
                        </span>
                      )}
                      {album.eventDate && (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          {formatDate(album.eventDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {hasMore && (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center py-8 text-sm text-muted-foreground"
              data-testid="albums-load-more"
            >
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading more albums…
            </div>
          )}
          </>
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
