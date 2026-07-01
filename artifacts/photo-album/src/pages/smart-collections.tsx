import { Link } from "wouter";
import { useListCollections } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FadeImage } from "@/components/ui/fade-image";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { collectionKeywords } from "@/lib/aiSuggestions";

export default function SmartCollections() {
  const { data: collections, isLoading } = useListCollections();

  const withKeywords = (collections ?? []).filter((c) => !!collectionKeywords(c));

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="smart-collections-page">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          <h1 className="text-2xl font-bold text-foreground">Smart Collections</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">
          AI-suggested photos automatically matched to each collection by description.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : withKeywords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No smart collections yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Create a collection with a descriptive title or description and the AI will start matching photos to it.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {withKeywords.map((col) => (
              <Link key={col.id} href={`/smart-collections/${col.id}`}>
                <div className="group rounded-xl border border-border overflow-hidden bg-card hover:border-amber-400/60 transition-colors cursor-pointer">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {col.coverPhotoUrl ? (
                      <FadeImage
                        src={col.coverPhotoUrl}
                        alt={col.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Sparkles className="h-10 w-10 text-amber-400/40" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI
                    </span>
                    {col.photoCount > 0 && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium">
                        {col.photoCount} photo{col.photoCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-foreground truncate">{col.title}</p>
                    {col.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{col.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">AI-matched photos</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
