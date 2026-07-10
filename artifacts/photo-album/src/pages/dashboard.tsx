import { useState, useMemo } from "react";
import { FadeImage } from "@/components/ui/fade-image";
import {
  useGetDashboardStats,
  useGetRecentPhotos,
  useGetTopRatedPhotos,
  useListCollections,
  useListAlbums,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Images, Camera, Users, FolderOpen, Star, Sparkles } from "lucide-react";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Link } from "wouter";

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-12 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-foreground mt-0.5">{value?.toLocaleString() ?? "0"}</p>
        )}
      </div>
    </div>
  );
}

function CardGrid({
  loading,
  empty,
  skeletonCount,
  cols,
  children,
}: {
  loading: boolean;
  empty: boolean;
  skeletonCount?: number;
  cols?: string;
  children: React.ReactNode;
}) {
  const gridCols = cols ?? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  if (loading) {
    return (
      <div className={`grid ${gridCols} gap-4`}>
        {Array.from({ length: skeletonCount ?? 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
        ))}
      </div>
    );
  }
  if (empty) {
    return <p className="text-sm text-muted-foreground py-4">Nothing here yet.</p>;
  }
  return <div className={`grid ${gridCols} gap-4`}>{children}</div>;
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <Link href={href} className="text-sm text-primary hover:underline">
        View all
      </Link>
    </div>
  );
}

function PhotoStrip({
  photos,
  loading,
  onPhotoClick,
}: {
  photos?: LightboxPhoto[];
  loading: boolean;
  onPhotoClick: (photo: LightboxPhoto) => void;
}) {
  if (loading) {
    return (
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-lg mb-3 break-inside-avoid" />
        ))}
      </div>
    );
  }
  if (!photos || photos.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No photos yet.</p>;
  }
  return (
    <MasonryGrid
      items={photos}
      getKey={(photo) => photo.id}
      renderItem={(photo) => (
        <button
          key={photo.id}
          onClick={() => onPhotoClick(photo)}
          className="relative mb-3 break-inside-avoid w-full rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          data-testid="photo-strip-item"
          aria-label={`Preview ${photo.name ?? "photo"}`}
        >
          <FadeImage
            fit="contain"
            loading="lazy"
            src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
            alt={photo.name ?? "Photo"}
            className="w-full h-auto transition-transform duration-200 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-2 opacity-0 group-hover:opacity-100">
            {photo.averageRating != null && (
              <div className="flex items-center gap-0.5 ml-auto">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-xs text-white font-medium">{photo.averageRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </button>
      )}
    />
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentPhotos, isLoading: recentLoading } = useGetRecentPhotos();
  const { data: topRated, isLoading: topLoading } = useGetTopRatedPhotos();
  const { data: collections, isLoading: collectionsLoading } = useListCollections();
  const { data: albums, isLoading: albumsLoading } = useListAlbums();

  const [selectedPhoto, setSelectedPhoto] = useState<LightboxPhoto | null>(null);

  const allPhotos = useMemo<LightboxPhoto[]>(() => {
    const seen = new Set<number>();
    const result: LightboxPhoto[] = [];
    for (const p of [...(topRated ?? []), ...(recentPhotos ?? [])]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    }
    return result;
  }, [topRated, recentPhotos]);

  const selectedIndex = selectedPhoto ? allPhotos.findIndex((p) => p.id === selectedPhoto.id) : -1;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < allPhotos.length - 1;

  function handlePrev() {
    if (hasPrev) setSelectedPhoto(allPhotos[selectedIndex - 1]);
  }
  function handleNext() {
    if (hasNext) setSelectedPhoto(allPhotos[selectedIndex + 1]);
  }

  return (
    <AppLayout>
      <div className="space-y-8" data-testid="dashboard-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your marketing photo selection workspace at a glance.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-grid">
          <StatCard label="Albums" value={stats?.totalAlbums} icon={Images} loading={statsLoading} />
          <StatCard label="Photos" value={stats?.totalPhotos} icon={Camera} loading={statsLoading} />
          <StatCard label="Team Members" value={stats?.totalUsers} icon={Users} loading={statsLoading} />
          <StatCard label="Collections" value={stats?.totalCollections} icon={FolderOpen} loading={statsLoading} />
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-foreground">Smart Collections</h2>
            </div>
          </div>
          {collectionsLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          ) : !collections || collections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nothing here yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="dashboard-smart-collections">
              {collections.map((col) => (
                <Link key={col.id} href={`/smart-collections/${col.id}`}>
                  <Badge
                    variant="secondary"
                    className="rounded-full gap-1.5 px-3 py-1 cursor-pointer hover:border-amber-400/60"
                    data-testid={`smart-collection-pill-${col.id}`}
                  >
                    <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                    {col.title}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Collections" href="/collections" />
          <CardGrid loading={collectionsLoading} empty={!collections || collections.length === 0}>
            {(collections ?? []).map((col) => (
              <Link key={col.id} href={`/collections/${col.id}`}>
                <div className="group rounded-xl border border-border overflow-hidden bg-card hover:border-primary/40 transition-colors cursor-pointer">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {col.coverPhotoUrl ? (
                      <FadeImage
                        src={col.coverPhotoUrl}
                        alt={col.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-foreground truncate">{col.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {col.photoCount} photo{col.photoCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </CardGrid>
        </section>

        <section>
          <SectionHeader title="Albums" href="/albums" />
          <CardGrid loading={albumsLoading} empty={!albums || albums.length === 0}>
            {(albums ?? []).map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`}>
                <div className="group rounded-xl border border-border overflow-hidden bg-card hover:border-primary/40 transition-colors cursor-pointer">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {album.coverPhotoUrl ? (
                      <FadeImage
                        src={album.coverPhotoUrl}
                        alt={album.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Images className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-foreground truncate">{album.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {album.photoCount} photo{album.photoCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </CardGrid>
        </section>

        <section>
          <SectionHeader title="Favorites" href="/photos?sort=top-rated" />
          <PhotoStrip photos={topRated ?? []} loading={topLoading} onPhotoClick={setSelectedPhoto} />
        </section>

        <section>
          <SectionHeader title="Recent" href="/photos?sort=recent" />
          <PhotoStrip photos={recentPhotos ?? []} loading={recentLoading} onPhotoClick={setSelectedPhoto} />
        </section>
      </div>

      <PhotoLightbox
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </AppLayout>
  );
}
