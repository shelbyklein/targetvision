import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPhoto,
  useRatePhoto,
  useAddPhotoTag,
  useRemovePhotoTag,
  useListCategories,
  useAddPhotoCategory,
  useRemovePhotoCategory,
  useUpdatePhoto,
  useDeletePhoto,
  getGetPhotoQueryKey,
  getListAlbumPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Star, X, Plus, ArrowLeft, Trash2, CalendarDays, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function StarRating({ photoId, myRating, uploaderId, currentUserId, onRated }: {
  photoId: number;
  myRating?: number | null;
  uploaderId: number;
  currentUserId?: number;
  onRated: () => void;
}) {
  const [hovered, setHovered] = useState(0);
  const { mutate: ratePhoto, isPending } = useRatePhoto();
  const { toast } = useToast();

  const isOwn = currentUserId === uploaderId;

  function handleRate(score: number) {
    if (isOwn) {
      toast({ title: "Cannot rate your own photo", variant: "destructive" });
      return;
    }
    ratePhoto(
      { id: photoId, data: { score } },
      {
        onSuccess: () => {
          onRated();
          toast({ title: `Rated ${score} star${score !== 1 ? "s" : ""}` });
        },
        onError: () => toast({ title: "Failed to submit rating", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">
        {isOwn ? "Your photo" : "Your Rating"}
      </Label>
      <div className="flex items-center gap-1" data-testid="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            disabled={isPending || isOwn}
            className="p-0.5 disabled:cursor-not-allowed disabled:opacity-50 transition-transform hover:scale-110"
            data-testid={`star-${star}`}
          >
            <Star
              className={
                (hovered || myRating || 0) >= star
                  ? "h-6 w-6 fill-amber-400 text-amber-400"
                  : "h-6 w-6 text-muted-foreground/40"
              }
            />
          </button>
        ))}
        {myRating != null && (
          <span className="text-sm text-muted-foreground ml-2">({myRating}/5)</span>
        )}
      </div>
    </div>
  );
}

export default function PhotoDetail() {
  const { id } = useParams<{ id: string }>();
  const photoId = parseInt(id, 10);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [newTag, setNewTag] = useState("");

  const { data: photo, isLoading } = useGetPhoto(photoId, {
    query: { enabled: !!photoId, queryKey: getGetPhotoQueryKey(photoId) },
  });
  const { data: me } = useGetMe();
  const { data: allCategories } = useListCategories();
  const { mutate: addTag } = useAddPhotoTag();
  const { mutate: removeTag } = useRemovePhotoTag();
  const { mutate: addCategory } = useAddPhotoCategory();
  const { mutate: removeCategory } = useRemovePhotoCategory();
  const { mutate: deletePhoto, isPending: deleting } = useDeletePhoto();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetPhotoQueryKey(photoId) });
    if (photo?.albumId) {
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(photo.albumId) });
    }
  }

  function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTag.trim()) return;
    addTag(
      { id: photoId, data: { tagName: newTag.trim().toLowerCase() } },
      {
        onSuccess: () => { setNewTag(""); invalidate(); },
        onError: () => toast({ title: "Failed to add tag", variant: "destructive" }),
      }
    );
  }

  function handleRemoveTag(tagId: number) {
    removeTag(
      { id: photoId, tagId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to remove tag", variant: "destructive" }) }
    );
  }

  function handleAddCategory(categoryId: string) {
    addCategory(
      { id: photoId, data: { categoryId: parseInt(categoryId, 10) } },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to add category", variant: "destructive" }) }
    );
  }

  function handleRemoveCategory(categoryId: number) {
    removeCategory(
      { id: photoId, categoryId },
      { onSuccess: invalidate, onError: () => toast({ title: "Failed to remove category", variant: "destructive" }) }
    );
  }

  function handleDelete() {
    deletePhoto(
      { id: photoId },
      {
        onSuccess: () => {
          toast({ title: "Photo deleted" });
          if (photo?.albumId) navigate(`/albums/${photo.albumId}`);
          else navigate("/albums");
        },
        onError: () => toast({ title: "Failed to delete photo", variant: "destructive" }),
      }
    );
  }

  const availableCategories = allCategories?.filter(
    (cat) => !photo?.categories?.some((c) => c.id === cat.id)
  );

  const canDelete = me && photo && (me.id === photo.uploaderId || me.role === "admin");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!photo) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">Photo not found.</p>
          <Link href="/albums"><Button variant="outline" className="mt-4">Back to Albums</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="photo-detail-page">
        <div className="flex items-center gap-3">
          {photo.albumId && (
            <Link href={`/albums/${photo.albumId}`}>
              <Button variant="ghost" size="sm" className="gap-1.5" data-testid="back-to-album">
                <ArrowLeft className="h-4 w-4" />
                {photo.albumTitle ?? "Album"}
              </Button>
            </Link>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-muted aspect-[4/3]">
              <img
                src={photo.url}
                alt={photo.caption ?? "Photo"}
                className="h-full w-full object-contain bg-black"
                data-testid="photo-image"
              />
            </div>
            {photo.caption && (
              <p className="text-sm text-muted-foreground italic">{photo.caption}</p>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-foreground" data-testid="photo-title">
                {photo.caption ?? "Untitled Photo"}
              </h1>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {photo.uploaderName && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    <span>Uploaded by {photo.uploaderName}</span>
                  </div>
                )}
                {photo.takenAt && (
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{new Date(photo.takenAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {photo.ratingCount > 0 && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 flex items-center justify-between" data-testid="rating-summary">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-foreground">
                    {photo.averageRating?.toFixed(1) ?? "—"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {photo.ratingCount} rating{photo.ratingCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            <StarRating
              photoId={photoId}
              myRating={photo.myRating}
              uploaderId={photo.uploaderId}
              currentUserId={me?.id}
              onRated={invalidate}
            />

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]" data-testid="photo-tags">
                {photo.tags?.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                      data-testid={`remove-tag-${tag.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!photo.tags || photo.tags.length === 0) && (
                  <span className="text-xs text-muted-foreground">No tags yet</span>
                )}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-2 mt-1">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag..."
                  className="h-8 text-sm"
                  data-testid="add-tag-input"
                />
                <Button type="submit" size="sm" variant="outline" className="h-8 px-2" disabled={!newTag.trim()} data-testid="add-tag-submit">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Categories</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]" data-testid="photo-categories">
                {photo.categories?.map((cat) => (
                  <Badge key={cat.id} variant="outline" className="gap-1 pr-1">
                    {cat.name}
                    <button
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                      data-testid={`remove-category-${cat.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!photo.categories || photo.categories.length === 0) && (
                  <span className="text-xs text-muted-foreground">No categories</span>
                )}
              </div>
              {availableCategories && availableCategories.length > 0 && (
                <Select onValueChange={handleAddCategory} data-testid="add-category-select">
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue placeholder="Add category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)} data-testid={`category-option-${cat.id}`}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {canDelete && (
              <>
                <Separator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2 w-full" data-testid="delete-photo-btn">
                      <Trash2 className="h-4 w-4" />
                      Delete Photo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The photo will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90" data-testid="confirm-delete-photo">
                        {deleting ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
