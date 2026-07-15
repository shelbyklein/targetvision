import { useState, useMemo, useEffect, Fragment } from "react";
import { FadeImage } from "@/components/ui/fade-image";
import {
  useGetDashboardStats,
  useGetRecentPhotos,
  useGetTopRatedPhotos,
  useListCollections,
  useListAlbums,
  useListProjects,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Images,
  Camera,
  Users,
  FolderOpen,
  FolderKanban,
  Star,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { PhotoLightbox, type LightboxPhoto } from "@/components/PhotoLightbox";
import { MasonryGrid } from "@/components/MasonryGrid";
import { startPhotoDrag } from "@/lib/photoDrag";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

// ── Dashboard layout (order + visibility), persisted per browser ─────────────
const SECTION_IDS = ["stats", "smart", "collections", "projects", "albums", "favorites", "recent"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  stats: "Stats",
  smart: "Smart Collections",
  collections: "Collections",
  projects: "Projects",
  albums: "Albums",
  favorites: "Favorites",
  recent: "Recent",
};

const DEFAULT_ORDER: SectionId[] = [...SECTION_IDS];
const LAYOUT_KEY = "dashboard_layout_v1";

interface Layout {
  order: SectionId[];
  hidden: SectionId[];
}

function isSectionId(x: unknown): x is SectionId {
  return typeof x === "string" && (SECTION_IDS as readonly string[]).includes(x);
}

function loadLayout(): Layout {
  const fallback: Layout = { order: [...DEFAULT_ORDER], hidden: [] };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Layout>;
    const order = (parsed.order ?? []).filter(isSectionId);
    // Append any sections added since the layout was saved (e.g. new "projects"),
    // so upgrades don't hide new content for existing users.
    for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
    const hidden = (parsed.hidden ?? []).filter(isSectionId);
    return { order, hidden };
  } catch {
    return fallback;
  }
}

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
          draggable
          onDragStart={(e) => startPhotoDrag(e, photo.id)}
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

// A reusable cover-card grid used by Collections, Projects and Albums.
function CoverCard({
  href,
  title,
  photoCount,
  coverUrl,
  fallbackIcon: FallbackIcon,
}: {
  href: string;
  title: string;
  photoCount: number;
  coverUrl?: string | null;
  fallbackIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href}>
      <div className="group rounded-xl border border-border overflow-hidden bg-card hover:border-primary/40 transition-colors cursor-pointer">
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {coverUrl ? (
            <FadeImage
              src={coverUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <FallbackIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="font-medium text-sm text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {photoCount} photo{photoCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CustomizeDialog({ layout, onChange }: { layout: Layout; onChange: (l: Layout) => void }) {
  const hidden = new Set(layout.hidden);

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= layout.order.length) return;
    const order = [...layout.order];
    [order[index], order[j]] = [order[j], order[index]];
    onChange({ ...layout, order });
  }

  function toggle(id: SectionId) {
    onChange({
      ...layout,
      hidden: hidden.has(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id],
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" data-testid="customize-dashboard-btn">
          <SlidersHorizontal className="h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize dashboard</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Reorder the sections and choose which ones appear. Saved to this browser.
        </p>
        <div className="space-y-1.5 pt-1" data-testid="customize-section-list">
          {layout.order.map((id, i) => {
            const isHidden = hidden.has(id);
            return (
              <div
                key={id}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5"
                data-testid={`customize-row-${id}`}
              >
                <span className={cn("flex-1 text-sm font-medium", isHidden && "text-muted-foreground line-through")}>
                  {SECTION_LABELS[id]}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${SECTION_LABELS[id]} up`}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === layout.order.length - 1} aria-label={`Move ${SECTION_LABELS[id]} down`}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggle(id)}
                  aria-label={`${isHidden ? "Show" : "Hide"} ${SECTION_LABELS[id]}`}
                  data-testid={`customize-toggle-${id}`}
                >
                  {isHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => onChange({ order: [...DEFAULT_ORDER], hidden: [] })}
            data-testid="customize-reset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to default
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentPhotos, isLoading: recentLoading } = useGetRecentPhotos();
  const { data: topRated, isLoading: topLoading } = useGetTopRatedPhotos();
  const { data: collections, isLoading: collectionsLoading } = useListCollections();
  const { data: albums, isLoading: albumsLoading } = useListAlbums();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const [selectedPhoto, setSelectedPhoto] = useState<LightboxPhoto | null>(null);
  const [layout, setLayout] = useState<Layout>(loadLayout);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // localStorage unavailable — customization just won't persist.
    }
  }, [layout]);

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

  const sectionRenderers: Record<SectionId, () => React.ReactNode> = {
    stats: () => (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-grid">
        <StatCard label="Albums" value={stats?.totalAlbums} icon={Images} loading={statsLoading} />
        <StatCard label="Photos" value={stats?.totalPhotos} icon={Camera} loading={statsLoading} />
        <StatCard label="Team Members" value={stats?.totalUsers} icon={Users} loading={statsLoading} />
        <StatCard label="Collections" value={stats?.totalCollections} icon={FolderOpen} loading={statsLoading} />
      </div>
    ),
    smart: () => (
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
    ),
    collections: () => (
      <section>
        <SectionHeader title="Collections" href="/collections" />
        <CardGrid loading={collectionsLoading} empty={!collections || collections.length === 0}>
          {(collections ?? []).map((col) => (
            <CoverCard
              key={col.id}
              href={`/collections/${col.id}`}
              title={col.title}
              photoCount={col.photoCount}
              coverUrl={col.coverPhotoUrl}
              fallbackIcon={FolderOpen}
            />
          ))}
        </CardGrid>
      </section>
    ),
    projects: () => (
      <section>
        <SectionHeader title="Projects" href="/projects" />
        <CardGrid loading={projectsLoading} empty={!projects || projects.length === 0}>
          {(projects ?? []).map((project) => (
            <CoverCard
              key={project.id}
              href={`/projects/${project.id}`}
              title={project.name}
              photoCount={project.photoCount}
              coverUrl={project.coverPhotoThumbnailKey ? `/api/storage${project.coverPhotoThumbnailKey}` : project.coverPhotoUrl}
              fallbackIcon={FolderKanban}
            />
          ))}
        </CardGrid>
      </section>
    ),
    albums: () => (
      <section>
        <SectionHeader title="Albums" href="/albums" />
        <CardGrid loading={albumsLoading} empty={!albums || albums.length === 0}>
          {(albums ?? []).map((album) => (
            <CoverCard
              key={album.id}
              href={`/albums/${album.id}`}
              title={album.title}
              photoCount={album.photoCount}
              coverUrl={album.coverPhotoUrl}
              fallbackIcon={Images}
            />
          ))}
        </CardGrid>
      </section>
    ),
    favorites: () => (
      <section>
        <SectionHeader title="Favorites" href="/photos?sort=top-rated" />
        <PhotoStrip photos={topRated ?? []} loading={topLoading} onPhotoClick={setSelectedPhoto} />
      </section>
    ),
    recent: () => (
      <section>
        <SectionHeader title="Recent" href="/photos?sort=recent" />
        <PhotoStrip photos={recentPhotos ?? []} loading={recentLoading} onPhotoClick={setSelectedPhoto} />
      </section>
    ),
  };

  const hiddenSet = new Set(layout.hidden);
  const visibleSections = layout.order.filter((id) => !hiddenSet.has(id));

  return (
    <AppLayout>
      <div className="space-y-8" data-testid="dashboard-page">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Your marketing photo selection workspace at a glance.</p>
          </div>
          <CustomizeDialog layout={layout} onChange={setLayout} />
        </div>

        {visibleSections.map((id) => (
          <Fragment key={id}>{sectionRenderers[id]()}</Fragment>
        ))}
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
