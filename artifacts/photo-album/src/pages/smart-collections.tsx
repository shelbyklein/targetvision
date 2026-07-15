import { Link } from "wouter";
import { useListCollections } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export default function SmartCollections() {
  const { data: collections, isLoading } = useListCollections();

  const smartCollections = collections ?? [];

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="smart-collections-page">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          <h1 className="text-2xl font-bold text-foreground">Smart Collections</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">
          Browse each collection by visual similarity — photos are ranked by how closely they match
          the collection's search term.
        </p>

        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        ) : smartCollections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No smart collections yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Create a collection and open it here to browse matching photos by visual similarity.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="smart-collections-list">
            {smartCollections.map((col) => (
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
      </div>
    </AppLayout>
  );
}
