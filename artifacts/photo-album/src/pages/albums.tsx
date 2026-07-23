import { useState } from "react";
import { Link, useLocation } from "wouter";
import { FadeImage } from "@/components/ui/fade-image";
import { useListAlbums, useCreateAlbum, useReorderAlbums, getListAlbumsQueryKey, type Album } from "@workspace/api-client-react";
import { useCardReorder } from "@/hooks/useCardReorder";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Folder } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Images, CalendarDays, Camera, EyeOff, Upload, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";
import { formatDate } from "@/lib/format-date";

type AlbumItem = Album;

// Distinct non-empty folder labels across albums, for datalist suggestions.
export function collectFolders(albums: AlbumItem[] | undefined): string[] {
  const set = new Set<string>();
  for (const a of albums ?? []) if (a.folder) set.add(a.folder);
  return [...set].sort((x, y) => y.localeCompare(x, undefined, { numeric: true }));
}

function CreateAlbumDialog({ onCreated, folderSuggestions }: { onCreated: () => void; folderSuggestions: string[] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [folder, setFolder] = useState("");
  const { mutate: createAlbum, isPending } = useCreateAlbum();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createAlbum(
      {
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          eventDate: eventDate || undefined,
          folder: folder.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setDescription("");
          setEventDate("");
          setFolder("");
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
          <div className="space-y-1.5">
            <Label htmlFor="album-folder">Folder</Label>
            <Input
              id="album-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder='Optional — e.g. "2026"'
              list="album-folder-options"
              data-testid="album-folder-input"
            />
            <datalist id="album-folder-options">
              {folderSuggestions.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
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
// 4-column grid). Windowing only applies to the single-flat-list view; once
// folders exist the page renders grouped sections in full (cover images are
// still lazy-loaded).
const ALBUMS_PAGE_SIZE = 12;

// One reorderable grid of album cards. Sections each get their own instance so
// drag-to-reorder works within a folder; onCommit receives the section's new
// id order and the parent stitches the full flat order.
function AlbumGrid({
  albums,
  isAdmin,
  onCommit,
  testId,
}: {
  albums: AlbumItem[];
  isAdmin: boolean;
  onCommit: (orderedIds: number[]) => void;
  testId?: string;
}) {
  const reorder = useCardReorder({
    ids: albums.map((a) => a.id),
    onCommit,
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid={testId ?? "albums-grid"}>
      {reorder.arrange(albums, (a) => a.id).map((album) => (
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
                {isAdmin && !!album.hiddenCount && (
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
  );
}

export default function Albums() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: albums, isLoading } = useListAlbums();
  const { data: me } = useGetMe();
  const [visibleCount, setVisibleCount] = useState(ALBUMS_PAGE_SIZE);
  const isAdmin = me?.role === "admin";

  const folders = collectFolders(albums);
  const grouped = folders.length > 0;

  // Grouped view (#149): folder sections newest-label-first (numeric-aware, so
  // "2026" sorts above "2025"), with ungrouped albums in a trailing section.
  const sections: { label: string | null; albums: AlbumItem[] }[] = grouped
    ? [
        ...folders.map((label) => ({ label: label as string | null, albums: (albums ?? []).filter((a) => a.folder === label) })),
        { label: null, albums: (albums ?? []).filter((a) => !a.folder) },
      ].filter((s) => s.albums.length > 0)
    : [{ label: null, albums: albums ?? [] }];

  // Windowing only in the flat view (see ALBUMS_PAGE_SIZE note).
  const totalAlbums = albums?.length ?? 0;
  const visibleAlbums = grouped ? (albums ?? []) : (albums?.slice(0, visibleCount) ?? []);
  const hasMore = !grouped && totalAlbums > visibleCount;
  const sentinelRef = useInfiniteScroll(
    () => setVisibleCount((c) => c + ALBUMS_PAGE_SIZE),
    hasMore,
  );

  function refetch() {
    qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
  }

  const reorderMutation = useReorderAlbums();

  // A section commits its own new order; persist the full flat order with the
  // other sections (and any albums beyond the flat-view window) unchanged.
  function commitSectionOrder(sectionLabel: string | null, orderedIds: number[]) {
    const inSection = new Set(orderedIds);
    const flat: number[] = [];
    for (const section of sections) {
      if (section.label === sectionLabel) flat.push(...orderedIds);
      else flat.push(...section.albums.map((a) => a.id));
    }
    const rest = (albums ?? []).map((a) => a.id).filter((id) => !flat.includes(id) && !inSection.has(id));
    reorderMutation.mutate({ data: { ids: [...flat, ...rest] } }, { onSuccess: refetch });
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
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/bulk-upload")} data-testid="bulk-upload-btn">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <CreateAlbumDialog onCreated={refetch} folderSuggestions={folders} />
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
          {grouped ? (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.label ?? "(ungrouped)"} className="space-y-3" data-testid={`albums-folder-${section.label ?? "ungrouped"}`}>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    {section.label ?? "Ungrouped"}
                    <span className="text-xs font-normal text-muted-foreground">
                      {section.albums.length} album{section.albums.length !== 1 ? "s" : ""}
                    </span>
                  </h2>
                  <AlbumGrid
                    albums={section.albums}
                    isAdmin={isAdmin}
                    onCommit={(ids) => commitSectionOrder(section.label, ids)}
                    testId={section.label ? undefined : "albums-grid"}
                  />
                </div>
              ))}
            </div>
          ) : (
            <AlbumGrid
              albums={visibleAlbums}
              isAdmin={isAdmin}
              onCommit={(ids) => commitSectionOrder(null, ids)}
            />
          )}
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
            <CreateAlbumDialog onCreated={refetch} folderSuggestions={folders} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
