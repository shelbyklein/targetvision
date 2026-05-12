import { useGetTagCloud } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "lucide-react";

export default function TagsPage() {
  const { data: tagCloud, isLoading } = useGetTagCloud();

  const maxCount = Math.max(...(tagCloud?.map((t) => t.count) ?? [1]), 1);

  function getFontSize(count: number): number {
    const minSize = 13;
    const maxSize = 32;
    return minSize + ((count / maxCount) * (maxSize - minSize));
  }

  function getOpacity(count: number): number {
    return 0.5 + (count / maxCount) * 0.5;
  }

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="tags-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tag Cloud</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tagCloud?.length ?? 0} tag{tagCloud?.length !== 1 ? "s" : ""} across all photos. Size reflects usage frequency.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-wrap gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-full" style={{ width: `${60 + Math.random() * 60}px` }} />
            ))}
          </div>
        ) : tagCloud && tagCloud.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-wrap gap-x-4 gap-y-3 items-baseline" data-testid="tag-cloud">
            {tagCloud.map((tag) => (
              <span
                key={tag.id}
                className="text-primary font-medium cursor-default select-none transition-opacity hover:opacity-100"
                style={{
                  fontSize: `${getFontSize(tag.count)}px`,
                  opacity: getOpacity(tag.count),
                }}
                data-testid="tag-cloud-word"
                title={`${tag.count} photo${tag.count !== 1 ? "s" : ""}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-border bg-card" data-testid="tags-empty">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Tag className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No tags yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Tags will appear here once photos have been tagged. Add tags from any photo's detail page.
            </p>
          </div>
        )}

        {tagCloud && tagCloud.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="tag-list">
            {tagCloud.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2" data-testid="tag-row">
                <span className="text-sm font-medium text-foreground">{tag.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
