import { useState } from "react";
import {
  useListDuplicatePhotoGroups,
  getListDuplicatePhotoGroupsQueryKey,
  useDeletePhoto,
  useBulkDeletePhotos,
  useContentHashBackfillStatus,
  useBackfillContentHashes,
  getGetRecentPhotosQueryKey,
  getGetTopRatedPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Copy, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DuplicatePhotoCard } from "./DuplicatePhotoCard";

type BackfillResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

export function DuplicatesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastBackfill, setLastBackfill] = useState<BackfillResult | null>(null);

  const { data: statusData, isLoading: isStatusLoading } = useContentHashBackfillStatus();
  const { mutate: backfill, isPending: isBackfilling } = useBackfillContentHashes();
  const { data: dupData, isLoading: isDupLoading } = useListDuplicatePhotoGroups();
  const { mutate: deletePhoto, isPending: isDeleting } = useDeletePhoto();
  const { mutate: bulkDelete, isPending: isBulkDeleting } = useBulkDeletePhotos();

  const missingCount = statusData?.missingCount ?? null;
  const groups = dupData?.groups ?? [];

  // Per group keep one photo — a cover if the group has any (covers can't be
  // deleted), otherwise the first — and mark every other non-cover copy for
  // deletion. `extras` is the full set of deletable duplicate ids.
  const extras = groups.flatMap((group) => {
    const hasCover = group.photos.some((p) => p.isAlbumCover);
    const deletable = hasCover
      ? group.photos.filter((p) => !p.isAlbumCover)
      : group.photos.slice(1);
    return deletable;
  });
  const extraIds = extras.map((p) => p.id);
  const extrasInCollections = extras.filter((p) => p.collectionCount > 0).length;

  function refresh() {
    qc.invalidateQueries({ queryKey: getListDuplicatePhotoGroupsQueryKey() });
    qc.invalidateQueries({ queryKey: ["admin", "photos", "content-hash-backfill-status"] });
    qc.invalidateQueries({ queryKey: getGetRecentPhotosQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTopRatedPhotosQueryKey() });
  }

  function handleBulkDelete() {
    if (extraIds.length === 0) return;
    bulkDelete(
      { data: { ids: extraIds } },
      {
        onSuccess: (result) => {
          toast({ title: `Deleted ${result.deleted} duplicate${result.deleted !== 1 ? "s" : ""}` });
          refresh();
        },
        onError: () => toast({ title: "Bulk delete failed", variant: "destructive" }),
      },
    );
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
            Find byte-identical duplicate photos and remove the extras — one at a time, or all at once (keeping one per group).
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
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground flex-1 min-w-[16rem]">
                {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} found. Keep the copy you want and
                delete the rest, or delete all extras at once. Album covers can't be deleted here — change the
                album's cover first.
              </p>
              {extraIds.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isBulkDeleting}
                      className="shrink-0 gap-1.5"
                      data-testid="delete-all-duplicates-btn"
                    >
                      {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete {extraIds.length} extra{extraIds.length !== 1 ? "s" : ""}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {extraIds.length} duplicate photo{extraIds.length !== 1 ? "s" : ""}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This keeps one photo from each identical group (an album cover when there is one) and
                        permanently deletes the rest, including their stored files. This cannot be undone.
                        {extrasInCollections > 0 && (
                          <>
                            {" "}
                            {extrasInCollections} of them belong to collections and will be removed from those too.
                          </>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDelete}
                        className="bg-destructive hover:bg-destructive/90"
                        data-testid="confirm-delete-all-duplicates"
                      >
                        Delete {extraIds.length} photo{extraIds.length !== 1 ? "s" : ""}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
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
