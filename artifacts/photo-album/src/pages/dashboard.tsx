import { useState, useMemo } from "react";
import { FadeImage } from "@/components/ui/fade-image";
import {
  useGetDashboardStats,
  useGetRecentPhotos,
  useGetTopRatedPhotos,
  useListCollections,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Images, Camera, Users, FolderOpen, Star } from "lucide-react";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
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
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }
  if (!photos || photos.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No photos yet.</p>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {photos.map((photo) => (
        <button
          key={photo.id}
          onClick={() => onPhotoClick(photo)}
          className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          data-testid="photo-strip-item"
          aria-label={`Preview ${photo.name ?? "photo"}`}
        >
          <FadeImage
            src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
            alt={photo.name ?? "Photo"}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
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
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentPhotos, isLoading: recentLoading } = useGetRecentPhotos();
  const { data: topRated, isLoading: topLoading } = useGetTopRatedPhotos();
  const { data: collections, isLoading: collectionsLoading } = useListCollections();

  const [selectedPhoto, setSelectedPhoto] = useState<LightboxPhoto | null>(null);

  const allPhotos = useMemo<LightboxPhoto[]>(() => {
    const seen = new Set<number>();
    const result: LightboxPhoto[] = [];
    for (const p of [...(recentPhotos ?? []), ...(topRated ?? [])]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    }
    return result;
  }, [recentPhotos, topRated]);

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
          <h2 className="text-base font-semibold text-foreground mb-3">Recent Photos</h2>
          <PhotoStrip photos={recentPhotos ?? []} loading={recentLoading} onPhotoClick={setSelectedPhoto} />
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Top Rated</h2>
          <PhotoStrip photos={topRated ?? []} loading={topLoading} onPhotoClick={setSelectedPhoto} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Collections</h2>
            <Link href="/collections" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>

          {collectionsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
              ))}
            </div>
          ) : !collections || collections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No collections yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {collections.map((col) => (
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
            </div>
          )}
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
