import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useSearchPhotos,
  useListUsers,
  useListCategories,
  useGetTagCloud,
  useGetMe,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { Search, SlidersHorizontal, X, Star, Images } from "lucide-react";
import { cn } from "@/lib/utils";

function parseSearch(search: string) {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    q: p.get("q") ?? "",
    tag: p.get("tag") ?? "",
    categoryId: p.get("categoryId") ?? "",
    ratingMin: p.get("ratingMin") ?? "",
    ratingMax: p.get("ratingMax") ?? "",
    dateFrom: p.get("dateFrom") ?? "",
    dateTo: p.get("dateTo") ?? "",
    uploaderId: p.get("uploaderId") ?? "",
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

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const urlParams = parseSearch(searchString);
  const { q, tag, categoryId, ratingMin, ratingMax, dateFrom, dateTo, uploaderId } = urlParams;

  const [inputValue, setInputValue] = useState(q);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setInputValue(q);
  }, [q]);

  const { data: me } = useGetMe();
  const { data: users } = useListUsers({ query: { enabled: me?.role === "admin" } });
  const { data: categories } = useListCategories();
  const { data: tagCloud } = useGetTagCloud();

  const hasActiveFilters =
    !!tag || !!categoryId || !!ratingMin || !!ratingMax || !!dateFrom || !!dateTo || !!uploaderId;

  const searchParams = {
    q,
    ...(tag && { tag }),
    ...(categoryId && { categoryId: parseInt(categoryId, 10) }),
    ...(ratingMin && { ratingMin: parseFloat(ratingMin) }),
    ...(ratingMax && { ratingMax: parseFloat(ratingMax) }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(uploaderId && { uploaderId: parseInt(uploaderId, 10) }),
  };

  const { data: results, isLoading, isFetching } = useSearchPhotos(searchParams, {
    query: { enabled: !!q },
  });

  function navigate(next: Partial<ReturnType<typeof parseSearch>>) {
    const merged = { ...urlParams, ...next };
    setLocation(`/search${buildQs(merged)}`, { replace: true });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: inputValue.trim() });
  }

  function handleFilterChange(field: string, value: string) {
    navigate({ [field]: value });
  }

  function clearFilters() {
    navigate({
      tag: "",
      categoryId: "",
      ratingMin: "",
      ratingMax: "",
      dateFrom: "",
      dateTo: "",
      uploaderId: "",
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="search-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search Photos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search across album titles, tags, and uploaders.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2" data-testid="search-form">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search photos, albums, tags..."
              className="pl-9"
              data-testid="search-input"
            />
          </div>
          <Button type="submit" data-testid="search-submit">
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("gap-1.5", hasActiveFilters && "border-primary text-primary")}
            onClick={() => setShowFilters((v) => !v)}
            data-testid="toggle-filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                {[tag, categoryId, ratingMin, ratingMax, dateFrom, dateTo, uploaderId].filter(Boolean).length}
              </span>
            )}
          </Button>
        </form>

        {showFilters && (
          <div
            className="rounded-xl border border-border bg-card p-5 space-y-4"
            data-testid="filter-panel"
          >
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tag
                </label>
                <Select
                  value={tag || "__all__"}
                  onValueChange={(v) => handleFilterChange("tag", v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid="filter-tag">
                    <SelectValue placeholder="Any tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Any tag</SelectItem>
                    {tagCloud?.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name} ({t.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Category
                </label>
                <Select
                  value={categoryId || "__all__"}
                  onValueChange={(v) => handleFilterChange("categoryId", v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 text-sm" data-testid="filter-category">
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Any category</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Minimum rating
                </label>
                <StarRatingFilter
                  value={ratingMin}
                  onChange={(v) => handleFilterChange("ratingMin", v)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Maximum rating
                </label>
                <StarRatingFilter
                  value={ratingMax}
                  onChange={(v) => handleFilterChange("ratingMax", v)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date from
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  className="h-9 text-sm"
                  data-testid="filter-date-from"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date to
                </label>
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
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Uploader
                  </label>
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
                {tag && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Tag: {tag}
                    <button
                      type="button"
                      onClick={() => handleFilterChange("tag", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {categoryId && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Category:{" "}
                    {categories?.find((c) => String(c.id) === categoryId)?.name ?? categoryId}
                    <button
                      type="button"
                      onClick={() => handleFilterChange("categoryId", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {ratingMin && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Min rating: {ratingMin}+
                    <button
                      type="button"
                      onClick={() => handleFilterChange("ratingMin", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {ratingMax && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Max rating: {ratingMax}
                    <button
                      type="button"
                      onClick={() => handleFilterChange("ratingMax", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {dateFrom && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    From: {dateFrom}
                    <button
                      type="button"
                      onClick={() => handleFilterChange("dateFrom", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {dateTo && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    To: {dateTo}
                    <button
                      type="button"
                      onClick={() => handleFilterChange("dateTo", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {uploaderId && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Uploader:{" "}
                    {users?.find((u) => String(u.id) === uploaderId)?.name ?? uploaderId}
                    <button
                      type="button"
                      onClick={() => handleFilterChange("uploaderId", "")}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {!q && (
          <div
            className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-card"
            data-testid="search-empty-state"
          >
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              Search your photo library
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Enter a keyword to search across album titles, tags, and uploader names.
            </p>
          </div>
        )}

        {q && (isLoading || isFetching) && (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            data-testid="search-loading"
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        )}

        {q && !isLoading && !isFetching && results && (
          <>
            <p className="text-sm text-muted-foreground" data-testid="search-result-count">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
              {hasActiveFilters && " with active filters"}
            </p>

            {results.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-card"
                data-testid="search-no-results"
              >
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Images className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium text-foreground mb-1">No photos found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Try a different keyword or adjust your filters.
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                data-testid="search-results"
              >
                {results.map((photo) => (
                  <Link
                    key={photo.id}
                    href={`/photos/${photo.id}`}
                    data-testid="search-result-item"
                  >
                    <div className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted cursor-pointer">
                      <img
                        src={photo.url}
                        alt={photo.name ?? "Photo"}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
                        {photo.albumTitle && (
                          <p className="text-xs text-white/80 font-medium truncate">
                            {photo.albumTitle}
                          </p>
                        )}
                        {photo.tags && photo.tags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {photo.tags.slice(0, 3).map((t) => (
                              <span
                                key={t.id}
                                className="text-[10px] bg-white/20 text-white px-1 rounded"
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {photo.averageRating != null && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs text-white font-medium">
                              {photo.averageRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
