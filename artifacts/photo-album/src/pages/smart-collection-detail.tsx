import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCollection,
  useListPhotos,
  useAddPhotoToCollection,
  useUpdateCollection,
  useGenerateCollectionKeywords,
  useSetCollectionCover,
  getGetCollectionQueryKey,
  getListPhotosQueryKey,
} from "@workspace/api-client-react";
import type { Photo } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FadeImage } from "@/components/ui/fade-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { MasonryGrid } from "@/components/MasonryGrid";
import { startPhotoDrag } from "@/lib/photoDrag";
import { ArrowLeft, Sparkles, Star, ArrowUpDown, Plus, Check, Loader2, X, RefreshCw, Wand2, ImageIcon } from "lucide-react";
import { collectionKeywords } from "@/lib/aiSuggestions";
import { useToast } from "@/hooks/use-toast";

type SortOption = "newest" | "oldest" | "top-rated" | "name-az";

type RichPhoto = Photo;

function toLight(photo: RichPhoto): LightboxPhoto {
  return {
    id: photo.id,
    url: photo.url,
    thumbnailKey: photo.thumbnailKey,
    name: photo.filename,
    averageRating: photo.averageRating,
    albumId: photo.albumId,
  };
}

function sortPhotos(photos: RichPhoto[], sort: SortOption): RichPhoto[] {
  const copy = [...photos];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":
      return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "top-rated":
      return copy.sort((a, b) => {
        const rd = (b.averageRating ?? 0) - (a.averageRating ?? 0);
        if (rd !== 0) return rd;
        return b.ratingCount - a.ratingCount;
      });
    case "name-az":
      return copy.sort((a, b) => (a.filename ?? "").localeCompare(b.filename ?? ""));
  }
}

function parseAiKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).filter((k) => typeof k === "string" && k.trim()) : [];
  } catch {
    return raw
      .split(/[\s,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }
}

export default function SmartCollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const collectionId = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: collection, isLoading: collectionLoading } = useGetCollection(collectionId, {
    query: { enabled: !!collectionId, queryKey: getGetCollectionQueryKey(collectionId) },
  });

  const [localKeywords, setLocalKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (collection) {
      setLocalKeywords(parseAiKeywords(collection.aiKeywords));
    }
  }, [collection?.aiKeywords]);

  const { mutate: updateCollection } = useUpdateCollection();
  const { mutate: generateKeywords, isPending: isRegenerating } = useGenerateCollectionKeywords();

  const keywords = collection
    ? collectionKeywords({ ...collection, aiKeywords: JSON.stringify(localKeywords) })
    : "";

  const photosQueryParams = keywords ? { search: keywords, aiStatus: "has_description" as const } : undefined;

  const { data: rawPhotos, isLoading: photosLoading } = useListPhotos(
    photosQueryParams,
    { query: { enabled: !!keywords, queryKey: getListPhotosQueryKey(photosQueryParams) } },
  );

  const [sort, setSort] = useState<SortOption>("top-rated");
  const [selectedPhoto, setSelectedPhoto] = useState<LightboxPhoto | null>(null);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());

  const collectionPhotoIds = useMemo(
    () => new Set((collection?.photos ?? []).map((p) => p.id)),
    [collection?.photos],
  );

  const addPhotoMutation = useAddPhotoToCollection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
      },
    },
  });

  const [settingCoverId, setSettingCoverId] = useState<number | null>(null);
  const { mutate: setCollectionCover } = useSetCollectionCover({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
        toast({ title: "Cover photo updated" });
      },
      onError: () => toast({ title: "Failed to set cover photo", variant: "destructive" }),
      onSettled: () => setSettingCoverId(null),
    },
  });

  function handleSetCover(photoId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (settingCoverId !== null) return;
    setSettingCoverId(photoId);
    setCollectionCover({ id: collectionId, data: { photoId } });
  }

  function saveKeywords(kws: string[]) {
    setIsSaving(true);
    updateCollection(
      { id: collectionId, data: { aiKeywords: JSON.stringify(kws) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
        },
        onError: () => toast({ title: "Failed to save keywords", variant: "destructive" }),
        onSettled: () => setIsSaving(false),
      },
    );
  }

  function removeKeyword(kw: string) {
    const next = localKeywords.filter((k) => k !== kw);
    setLocalKeywords(next);
    saveKeywords(next);
  }

  function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newKeywordInput.trim().toLowerCase();
    if (!trimmed || localKeywords.includes(trimmed)) {
      setNewKeywordInput("");
      return;
    }
    const next = [...localKeywords, trimmed];
    setLocalKeywords(next);
    setNewKeywordInput("");
    saveKeywords(next);
  }

  function handleRefresh() {
    if (photosQueryParams) {
      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey(photosQueryParams) });
    }
    toast({ title: "Refreshing matched photos…" });
  }

  function handleRegenerate() {
    generateKeywords(
      { id: collectionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCollectionQueryKey(collectionId) });
          toast({ title: "Keywords regenerated with AI" });
        },
        onError: () => toast({ title: "AI keyword generation failed", variant: "destructive" }),
      },
    );
  }

  function handleAddPhoto(photoId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (collectionPhotoIds.has(photoId) || addingIds.has(photoId)) return;
    setAddingIds((prev) => new Set(prev).add(photoId));
    addPhotoMutation.mutate(
      { id: collectionId, data: { photoId } },
      {
        onSettled: () => {
          setAddingIds((prev) => {
            const next = new Set(prev);
            next.delete(photoId);
            return next;
          });
        },
      },
    );
  }

  const photos = useMemo(() => {
    if (!rawPhotos) return [];
    return sortPhotos(rawPhotos as RichPhoto[], sort);
  }, [rawPhotos, sort]);

  const selectedIndex = selectedPhoto ? photos.findIndex((p) => p.id === selectedPhoto.id) : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < photos.length - 1;

  const isLoading = collectionLoading || (!!keywords && photosLoading);

  if (!collectionLoading && !collection) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">Collection not found.</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="smart-collection-detail-page">
        <div className="flex items-start gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              {collectionLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h1 className="text-2xl font-bold text-foreground">{collection?.title}</h1>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              AI-suggested photos based on description match
            </p>
            {collection?.description && (
              <p className="text-xs text-muted-foreground max-w-xl">{collection.description}</p>
            )}
          </div>
        </div>

        {/* Keywords management panel */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3" data-testid="keywords-panel">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-sm font-semibold">Smart keywords</span>
              <span className="text-xs text-muted-foreground">— photos must match these terms</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleRegenerate}
                disabled={isRegenerating || collectionLoading}
                data-testid="regenerate-keywords-btn"
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {isRegenerating ? "Generating…" : "AI regenerate"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleRefresh}
                data-testid="refresh-photos-btn"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh photos
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[2rem] items-center" data-testid="keyword-chips">
            {collectionLoading ? (
              <>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </>
            ) : localKeywords.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                No keywords yet — add some below or click "AI regenerate"
              </span>
            ) : (
              localKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  data-testid="keyword-chip"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    disabled={isSaving}
                    aria-label={`Remove keyword ${kw}`}
                    className="ml-0.5 rounded-full hover:text-destructive transition-colors disabled:opacity-40"
                    data-testid="remove-keyword-btn"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          <form onSubmit={handleAddKeyword} className="flex gap-2" data-testid="add-keyword-form">
            <Input
              placeholder="Add a keyword…"
              value={newKeywordInput}
              onChange={(e) => setNewKeywordInput(e.target.value)}
              className="h-8 text-sm"
              data-testid="keyword-input"
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1.5 shrink-0"
              disabled={!newKeywordInput.trim() || isSaving}
              data-testid="add-keyword-btn"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-4 w-24 inline-block" />
            ) : (
              `${photos.length} photo${photos.length !== 1 ? "s" : ""} matched`
            )}
          </p>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="h-8 w-36 text-sm" data-testid="smart-sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-rated">Top rated</SelectItem>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name-az">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-lg mb-3 break-inside-avoid" />
            ))}
          </div>
        ) : !keywords ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No keywords to match</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Add keywords above or click "AI regenerate" to generate them from the collection title and description.
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No AI matches yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Photos with AI descriptions matching "{collection?.title}" will appear here once they're analysed.
            </p>
          </div>
        ) : (
          <MasonryGrid
            items={photos}
            getKey={(photo) => photo.id}
            data-testid="smart-collection-photo-grid"
            renderItem={(photo) => {
              const inCollection = collectionPhotoIds.has(photo.id);
              const isAdding = addingIds.has(photo.id);
              return (
                <button
                  key={photo.id}
                  draggable
                  onDragStart={(e) => startPhotoDrag(e, photo.id)}
                  onClick={() => setSelectedPhoto(toLight(photo))}
                  className="relative mb-3 break-inside-avoid w-full rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  data-testid="smart-photo-item"
                  aria-label={`Preview ${photo.filename ?? "photo"}`}
                >
                  <FadeImage
                    fit="contain"
                    loading="lazy"
                    src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
                    alt={photo.filename ?? "Photo"}
                    className="w-full h-auto transition-transform duration-200 group-hover:scale-105"
                  />

                  {/* Cover photo button — top right, always visible when active */}
                  {(() => {
                    const isCover = collection?.coverPhotoId === photo.id;
                    const isSetting = settingCoverId === photo.id;
                    return (
                      <button
                        onClick={(e) => handleSetCover(photo.id, e)}
                        disabled={isSetting || settingCoverId !== null}
                        aria-label={isCover ? "Current cover photo" : "Set as cover photo"}
                        data-testid="set-cover-btn"
                        className={`absolute top-1.5 right-1.5 z-10 flex items-center justify-center rounded-full w-7 h-7 transition-all focus:outline-none focus:ring-2 focus:ring-white/60 ${
                          isCover
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 backdrop-blur-sm"
                        } ${isSetting ? "opacity-100" : ""}`}
                      >
                        {isSetting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })()}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => handleAddPhoto(photo.id, e)}
                      disabled={inCollection || isAdding}
                      aria-label={
                        inCollection
                          ? `Already in ${collection?.title}`
                          : `Add to ${collection?.title}`
                      }
                      data-testid="add-to-collection-btn"
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/60 ${
                        inCollection
                          ? "bg-emerald-500/90 text-white cursor-default"
                          : "bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm"
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : inCollection ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {inCollection ? "In collection" : "Add"}
                    </button>
                    {photo.averageRating != null && (
                      <div className="flex items-center gap-0.5 ml-auto bg-black/60 rounded px-1.5 py-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-white font-medium">
                          {photo.averageRating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            }}
          />
        )}
      </div>

      <PhotoLightbox
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => hasPrev && setSelectedPhoto(toLight(photos[selectedIndex - 1]))}
        onNext={() => hasNext && setSelectedPhoto(toLight(photos[selectedIndex + 1]))}
      />
    </AppLayout>
  );
}
