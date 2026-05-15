import { useState } from "react";
import { useBackfillThumbnails } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ImageIcon, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type BackfillResult = {
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
};

export function ThumbnailsSection() {
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);
  const { mutate: backfill, isPending } = useBackfillThumbnails();

  function handleBackfill() {
    setLastResult(null);
    backfill(undefined, {
      onSuccess: (result) => {
        setLastResult(result);
        if (result.processed === 0) {
          toast({ title: "All photos already have thumbnails" });
        } else if (result.failed === 0) {
          toast({ title: `Generated ${result.succeeded} thumbnail${result.succeeded !== 1 ? "s" : ""}` });
        } else {
          toast({
            title: `Thumbnails generated with some errors`,
            description: `${result.succeeded} succeeded, ${result.failed} failed`,
            variant: "destructive",
          });
        }
      },
      onError: () =>
        toast({ title: "Thumbnail backfill failed", variant: "destructive" }),
    });
  }

  return (
    <div
      className="rounded-xl border border-border bg-card overflow-hidden"
      data-testid="thumbnails-section"
    >
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Thumbnail Backfill</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate thumbnails for any photos uploaded before thumbnail support was added.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Album and collection cover cards load faster when photos have thumbnails. This action
          finds all photos without a thumbnail and generates one from the original image.
        </p>

        {lastResult && (
          <div
            className="rounded-lg border border-border bg-background/50 px-4 py-3 text-sm space-y-1"
            data-testid="backfill-result"
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              {lastResult.failed === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              {lastResult.processed === 0
                ? "No photos needed thumbnails"
                : `Processed ${lastResult.processed} photo${lastResult.processed !== 1 ? "s" : ""}`}
            </div>
            {lastResult.processed > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground pl-6">
                <span className="text-emerald-700 dark:text-emerald-400">{lastResult.succeeded} succeeded</span>
                {lastResult.skipped > 0 && (
                  <span>{lastResult.skipped} skipped</span>
                )}
                {lastResult.failed > 0 && (
                  <span className="text-destructive">{lastResult.failed} failed</span>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleBackfill}
          disabled={isPending}
          data-testid="backfill-thumbnails-btn"
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          {isPending ? "Generating thumbnails…" : "Generate missing thumbnails"}
        </Button>
      </div>
    </div>
  );
}
