import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  useListPhotos,
  useListUsers,
  useGetMe,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Search, SlidersHorizontal, X, Star, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

function parseSearch(search: string) {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    search: p.get("search") ?? "",
    ratingMin: p.get("ratingMin") ?? "",
    uploaderId: p.get("uploaderId") ?? "",
    dateFrom: p.get("dateFrom") ?? "",
    dateTo: p.get("dateTo") ?? "",
    page: p.get("page") ?? "1",
  };
}

function buildQs(params: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function StarRatingFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {["", "1", "2", "3", "4"].map((v) => {
        const label = v ? `${v}+` : "Any";
        const isActive = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium border transition-colors",
              isActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
          >
            {v && <Star className="h-3 w-3 fill-current" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function PhotosPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const urlParams = parseSearch(searchString);
  const { search, ratingMin, uploaderId, dateFrom, dateTo, page } = urlParams;
  const [inputValue, setInputValue] = useState(search);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  const { data: me } = useGetMe();
  const { data: users } = useListUsers({ query: { enabled: me?.role === "admin" } });

  const apiParams = {
    ...(search && { search }),
    ...(ratingMin && { ratingMin: parseFloat(ratingMin) }),
    ...(uploaderId && { uploaderId: parseInt(uploaderId, 10) }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };

  const { data: photos, isLoading } = useListPhotos(
    Object.keys(apiParams).length > 0 ? apiParams : undefined
  );

  const hasActiveFilters = !!(ratingMin || uploaderId || dateFrom || dateTo);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const totalPhotos = photos?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPhotos / PAGE_SIZE));
  const currentPage = Math.min(pageNum, totalPages);
  const paginatedPhotos = photos?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function navigate(next: Partial<ReturnType<typeof parseSearch>>) {
    const merged = { ...urlParams, ...next };
    setLocation(`/photos${buildQs(merged)}`, { replace: true });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search: inputValue.trim(), page: "1" });
  }

  function handleFilterChange(field: string, value: string) {
    navigate({ [field]: value, page: "1" });
  }

  function clearFilters() {
    navigate({
      ratingMin: "",
      uploaderId: "",
      dateFrom: "",
      dateTo: "",
      page: "1",
    });
  }

  function clearSearch() {
    setInputValue("");
    navigate({ search: "", page: "1" });
  }

  function goToPage(p: number) {
    navigate({ page: String(p) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="photos-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">All Photos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading
                ? "Loading…"
                : `${totalPhotos.toLocaleString()} photo${totalPhotos !== 1 ? "s" : ""} across all albums`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", hasActiveFilters && "border-primary text-primary")}
            onClick={() => setShowFilters((v) => !v)}
            data-testid="toggle-filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                {[ratingMin, uploaderId, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2" data-testid="search-form">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search photos by caption, album, uploader…"
              className="pl-9"
              data-testid="search-input"
            />
          </div>
          <Button type="submit" data-testid="search-submit">Search</Button>
          {search && (
            <Button type="button" variant="outline" onClick={clearSearch} data-testid="clear-search">
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>

        {search && (
          <p className="text-sm text-muted-foreground" data-testid="search-query-label">
            Showing results for &ldquo;{search}&rdquo;
            {hasActiveFilters && " with active filters"}
          </p>
        )}

        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4" data-testid="filter-panel">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Filters</h2>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  data-testid="clear-filters"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Minimum rating</label>
                <StarRatingFilter
                  value={ratingMin}
                  onChange={(v) => handleFilterChange("ratingMin", v)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date from</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  className="h-9 text-sm"
                  data-testid="filter-date-from"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date to</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  className="h-9 text-sm"
                  data-testid="filter-date-to"
                />
              </div>

              {me?.role === "admin" && users && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Uploader</label>
                  <Select
                    value={uploaderId || "__all__"}
                    onValueChange={(v) =>
                      handleFilterChange("uploaderId", v === "__all__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid="filter-uploader">
                      <SelectValue placeholder="Any uploader" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Any uploader</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                {ratingMin && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Min rating: {ratingMin}+
                    <button type="button" onClick={() => handleFilterChange("ratingMin", "")} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {dateFrom && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    From: {dateFrom}
                    <button type="button" onClick={() => handleFilterChange("dateFrom", "")} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {dateTo && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    To: {dateTo}
                    <button type="button" onClick={() => handleFilterChange("dateTo", "")} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {uploaderId && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Uploader: {users?.find((u) => String(u.id) === uploaderId)?.name ?? uploaderId}
                    <button type="button" onClick={() => handleFilterChange("uploaderId", "")} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="photos-loading">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : paginatedPhotos && paginatedPhotos.length > 0 ? (
          <>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
              data-testid="photos-grid"
            >
              {paginatedPhotos.map((photo) => {
                const suggestionCount =
                  (photo.suggestedCollections?.length ?? 0) +
                  (photo.suggestedNewCollections?.length ?? 0);
                return (
                  <Link key={photo.id} href={`/photos/${photo.id}`} data-testid="photo-grid-item">
                    <div className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer">
                      <img
                        src={photo.thumbnailKey ? `/api/storage${photo.thumbnailKey}` : photo.url}
                        alt="Photo"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                        {photo.albumTitle && (
                          <p className="text-xs text-white/80 truncate">{photo.albumTitle}</p>
                        )}
                        {photo.averageRating != null && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs text-white font-medium">
                              {photo.averageRating.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-white/80 ml-0.5">
                              ({photo.ratingCount})
                            </span>
                          </div>
                        )}
                      </div>
                      {suggestionCount > 0 && (
                        <div
                          className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-primary/90 px-1.5 py-0.5 shadow"
                          title={`${suggestionCount} collection suggestion${suggestionCount !== 1 ? "s" : ""} — click to review`}
                          data-testid="suggestion-badge"
                        >
                          <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
                          <span className="text-[10px] font-semibold text-primary-foreground leading-none">
                            {suggestionCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2" data-testid="pagination">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  data-testid="pagination-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "…" ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => goToPage(item as number)}
                          className={cn(
                            "h-8 w-8 rounded text-sm font-medium transition-colors",
                            currentPage === item
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent text-muted-foreground hover:text-foreground"
                          )}
                          data-testid={`pagination-page-${item}`}
                        >
                          {item}
                        </button>
                      )
                    )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  data-testid="pagination-next"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-card"
            data-testid="photos-empty"
          >
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {hasActiveFilters ? "No photos match your filters" : "No photos yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {hasActiveFilters
                ? "Try adjusting or clearing your filters to see more results."
                : "Photos will appear here once they've been added to albums."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
