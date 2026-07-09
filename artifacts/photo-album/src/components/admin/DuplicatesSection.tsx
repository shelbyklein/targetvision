import { useState } from "react";
import {
  useListDuplicatePhotoGroups,
  getListDuplicatePhotoGroupsQueryKey,
  useDeletePhoto,
  useContentHashBackfillStatus,
  useBackfillContentHashes,
  type DuplicatePhoto,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Copy, CheckCircle2, Loader2, Trash2, ImageIcon, Star, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type BackfillResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function DuplicatePhotoCard({
  photo,
  onDelete,
  deleting,
}: {
  photo: DuplicatePhoto;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const inCollections = photo.collectionCount > 0;
  return (
    <div className="rounded-lg border border-border bg-background/50 overflow-hidden flex flex-col" data-testid={`duplicate-photo-${photo.id}`}>
      <Link href={`/photos/${photo.id}`}>
        <div className="aspect-square bg-muted overflow-hidden">
          {photo.thumbnailUrl ? (
            <img src={photo.thumbnailUrl} alt={photo.filename ?? `Photo ${photo.id}`} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </div>
      </Link>
      <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
        <div className="text-xs font-medium text-foreground truncate" title={photo.filename ?? undefined}>
          {photo.filename ?? `Photo #${photo.id}`}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {photo.albumTitle ?? "Untitled album"} · {formatDate(photo.createdAt)}
        </div>
        <div className="flex flex-wrap gap-1">
          {photo.isAlbumCover && (
            <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/50 text-amber-700 dark:text-amber-400">
              <Star className="h-3 w-3" /> Album cover
            </Badge>
          )}
          {inCollections && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <FolderOpen className="h-3 w-3" /> In {photo.collectionCount} collection{photo.collectionCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="mt-auto pt-1">
          {photo.isAlbumCover ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled
              className="w-full h-7 text-xs"
              title="This photo is an album cover. Change the album cover before deleting it."
              data-testid={`delete-duplicate-disabled-${photo.id}`}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Cover — can't delete
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={deleting}
                  className="w-full h-7 text-xs text-destructive hover:text-destructive"
                  data-testid={`delete-duplicate-${photo.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this duplicate?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the photo and its stored files. This cannot be undone.
                    {inCollections && (
                      <>
                        {" "}
                        This photo belongs to {photo.collectionCount} collection
                        {photo.collectionCount !== 1 ? "s" : ""} and will be removed from{" "}
                        {photo.collectionCount !== 1 ? "them" : "it"}.
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(photo.id)}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid={`confirm-delete-duplicate-${photo.id}`}
                  >
                    Delete photo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

export function DuplicatesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastBackfill, setLastBackfill] = useState<BackfillResult | null>(null);

  const { data: statusData, isLoading: isStatusLoading } = useContentHashBackfillStatus();
  const { mutate: backfill, isPending: isBackfilling } = useBackfillContentHashes();
  const { data: dupData, isLoading: isDupLoading } = useListDuplicatePhotoGroups();
  const { mutate: deletePhoto, isPending: isDeleting } = useDeletePhoto();

  const missingCount = statusData?.missingCount ?? null;
  const groups = dupData?.groups ?? [];

  function refresh() {
    qc.invalidateQueries({ queryKey: getListDuplicatePhotoGroupsQueryKey() });
    qc.invalidateQueries({ queryKey: ["admin", "photos", "content-hash-backfill-status"] });
  }

  function handleBackfill() {
    setLastBackfill(null);
    backfill(undefined, {
      onSuccess: (result) => {
        setLastBackfill(result);
        if (result.processed === 0) {
          toast({ title: "All photos already have a content hash" });
        } else if (result.failed === 0) {
          toast({ title: `Hashed ${result.updated} photo${result.updated !== 1 ? "s" : ""}` });
        } else {
          toast({
            title: "Content hashing completed with some errors",
            description: `${result.updated} hashed, ${result.failed} failed`,
            variant: "destructive",
          });
        }
        refresh();
      },
      onError: () => toast({ title: "Content hashing failed", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deletePhoto(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Duplicate deleted" });
          refresh();
        },
        onError: () => toast({ title: "Failed to delete photo", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="duplicates-section">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Copy className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Duplicate Photos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find byte-identical duplicate photos and remove the extras. Deletion is always a manual, per-photo action.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Content-hash backfill: hashes must exist before duplicates can be detected. */}
        <div className="rounded-lg border border-border bg-background/40 px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Duplicate detection compares each photo's content hash. Photos uploaded before hashing was added need
            their hash computed once.
          </p>
          <div className="text-sm" data-testid="content-hash-status">
            {isStatusLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
              </span>
            ) : missingCount === 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> All photos are hashed
              </span>
            ) : missingCount !== null ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                {missingCount} photo{missingCount !== 1 ? "s" : ""} not yet hashed
              </span>
            ) : null}
          </div>
          {lastBackfill && lastBackfill.processed > 0 && (
            <div className="text-xs text-muted-foreground">
              Hashed {lastBackfill.updated}, skipped {lastBackfill.skipped}, failed {lastBackfill.failed}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleBackfill}
            disabled={isBackfilling}
            data-testid="backfill-content-hashes-btn"
          >
            <Copy className="h-4 w-4 mr-2" />
            {isBackfilling ? "Computing hashes…" : "Compute missing hashes"}
          </Button>
        </div>

        {/* Duplicate groups */}
        {isDupLoading ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning for duplicates…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> No duplicate photos found
          </div>
        ) : (
          <div className="space-y-5" data-testid="duplicate-groups">
            <p className="text-sm text-muted-foreground">
              {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} found. Keep the copy you want and
              delete the rest. Album covers can't be deleted here — change the album's cover first.
            </p>
            {groups.map((group) => (
              <div key={group.contentHash} className="rounded-lg border border-border p-3 space-y-2" data-testid={`duplicate-group-${group.contentHash}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {group.photos.length} identical copies
                  </span>
                  <code className="text-[10px] text-muted-foreground truncate max-w-[40%]" title={group.contentHash}>
                    {group.contentHash.slice(0, 16)}…
                  </code>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group.photos.map((photo) => (
                    <DuplicatePhotoCard key={photo.id} photo={photo} onDelete={handleDelete} deleting={isDeleting} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
