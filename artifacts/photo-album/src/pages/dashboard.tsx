import { Link } from "wouter";
import {
  useGetDashboardStats,
  useGetRecentPhotos,
  useGetTopRatedPhotos,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Images, Camera, Users, FolderOpen, Star } from "lucide-react";

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

function PhotoStrip({ photos, loading }: { photos?: { id: number; url: string; name?: string | null; averageRating?: number | null }[]; loading: boolean }) {
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
        <Link key={photo.id} href={`/photos/${photo.id}`}>
          <div className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer" data-testid="photo-strip-item">
            <img src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url} alt={photo.name ?? "Photo"} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-end p-2 opacity-0 group-hover:opacity-100">
              {photo.averageRating != null && (
                <div className="flex items-center gap-0.5 ml-auto">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-white font-medium">{photo.averageRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentPhotos, isLoading: recentLoading } = useGetRecentPhotos();
  const { data: topRated, isLoading: topLoading } = useGetTopRatedPhotos();

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
          <PhotoStrip photos={recentPhotos ?? []} loading={recentLoading} />
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">Top Rated</h2>
          <PhotoStrip photos={topRated ?? []} loading={topLoading} />
        </section>
      </div>
    </AppLayout>
  );
}
