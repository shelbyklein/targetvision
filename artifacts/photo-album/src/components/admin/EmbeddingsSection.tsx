import { useState } from "react";
import {
  useEmbeddingStatus,
  useUpdateEmbeddingSettings,
  useBackfillEmbeddings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Boxes, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type BackfillResult = { processed: number; succeeded: number; failed: number };

export function EmbeddingsSection() {
  const { toast } = useToast();
  const { data: status, isLoading } = useEmbeddingStatus();
  const { mutate: updateSettings, isPending: updating } = useUpdateEmbeddingSettings();
  const { mutate: backfill, isPending: backfilling } = useBackfillEmbeddings();
  const [limitInput, setLimitInput] = useState("");
  const [lastResult, setLastResult] = useState<BackfillResult | null>(null);

  const configured = Boolean(status?.projectConfigured && status?.credentialsConfigured);

  function handleToggle(enabled: boolean) {
    updateSettings(
      { enabled },
      {
        onSuccess: () =>
          toast({ title: enabled ? "Image embeddings enabled" : "Image embeddings disabled" }),
        onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
      },
    );
  }

  function handleBackfill() {
    const trimmed = limitInput.trim();
    const limit = trimmed ? parseInt(trimmed, 10) : undefined;
    if (trimmed && (!Number.isInteger(limit) || (limit as number) <= 0)) {
      toast({ title: "Batch size must be a positive whole number", variant: "destructive" });
      return;
    }
    setLastResult(null);
    backfill(limit != null ? { limit } : undefined, {
      onSuccess: (result) => {
        setLastResult(result);
        if (result.processed === 0) {
          toast({ title: "All photos already have embeddings" });
        } else if (result.failed === 0) {
          toast({ title: `Embedded ${result.succeeded} photo${result.succeeded !== 1 ? "s" : ""}` });
        } else {
          toast({
            title: "Embedding backfill completed with some errors",
            description: `${result.succeeded} succeeded, ${result.failed} failed`,
            variant: "destructive",
          });
        }
      },
      onError: () => toast({ title: "Embedding backfill failed", variant: "destructive" }),
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="embeddings-section">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Boxes className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Image Embeddings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Google Vertex AI multimodal embeddings power semantic search and “similar photos”.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!isLoading && !configured && (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
            data-testid="embeddings-not-configured"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Vertex AI isn’t fully configured.</p>
              <p className="text-xs mt-0.5">
                Set <code>GOOGLE_APPLICATION_CREDENTIALS</code>
                {status && !status.projectConfigured && (
                  <>, <code>VERTEX_PROJECT</code></>
                )}{" "}
                and <code>VERTEX_LOCATION</code> in <code>.env</code>, then restart the API server.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Generate embeddings on upload</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status ? `${status.model} · ${status.location}` : "…"}
            </p>
          </div>
          <Switch
            checked={status?.enabled ?? false}
            onCheckedChange={handleToggle}
            disabled={isLoading || updating || !configured}
            data-testid="embeddings-enabled-switch"
          />
        </div>

        <div className="text-sm" data-testid="embeddings-status">
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking…
            </span>
          ) : status ? (
            <span className="text-muted-foreground">
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {status.embeddedCount}
              </span>{" "}
              embedded
              {status.missingCount > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    {status.missingCount}
                  </span>{" "}
                  missing
                </>
              )}
            </span>
          ) : null}
        </div>

        {lastResult && (
          <div
            className="rounded-lg border border-border bg-background/50 px-4 py-3 text-sm space-y-1"
            data-testid="embeddings-backfill-result"
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              {lastResult.failed === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              {lastResult.processed === 0
                ? "No photos needed embedding"
                : `Processed ${lastResult.processed} photo${lastResult.processed !== 1 ? "s" : ""}`}
            </div>
            {lastResult.processed > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground pl-6">
                <span className="text-emerald-700 dark:text-emerald-400">{lastResult.succeeded} succeeded</span>
                {lastResult.failed > 0 && (
                  <span className="text-destructive">{lastResult.failed} failed</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="embeddings-batch-size" className="text-xs text-muted-foreground">
              Batch size (blank = all)
            </Label>
            <Input
              id="embeddings-batch-size"
              type="number"
              min={1}
              placeholder="All"
              className="w-28 h-9"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              data-testid="embeddings-batch-size-input"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleBackfill}
            disabled={backfilling || !status?.enabled}
            data-testid="backfill-embeddings-btn"
            title={!status?.enabled ? "Enable embeddings first" : undefined}
          >
            <Boxes className="h-4 w-4 mr-2" />
            {backfilling ? "Embedding photos…" : "Embed photos missing vectors"}
          </Button>
        </div>
      </div>
    </div>
  );
}
