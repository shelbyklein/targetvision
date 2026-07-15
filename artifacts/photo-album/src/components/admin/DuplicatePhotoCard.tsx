import type { DuplicatePhoto } from "@workspace/api-client-react";
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
import { Trash2, ImageIcon, Star, FolderOpen } from "lucide-react";
import { Link } from "wouter";

export function formatDupDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

// A single photo tile in a duplicate / near-duplicate group: thumbnail, album +
// date, cover / collection badges, and a guarded delete (album covers can't be
// deleted here). Shared by the exact-duplicate and near-duplicate sections.
export function DuplicatePhotoCard({
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
          {photo.albumTitle ?? "Untitled album"} · {formatDupDate(String(photo.createdAt))}
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
