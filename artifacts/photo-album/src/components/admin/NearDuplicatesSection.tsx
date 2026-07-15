import { useState } from "react";
import {
  useNearDuplicatePhotoGroups,
  getNearDuplicatePhotoGroupsQueryKey,
  usePerceptualHashBackfillStatus,
  useBackfillPerceptualHashes,
  useDeletePhoto,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CopyCheck, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DuplicatePhotoCard } from "./DuplicatePhotoCard";

type BackfillResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

// Hamming-distance presets. Lower = stricter (only very close matches); higher
// catches heavier re-encodes/crops at the cost of more false positives.
const THRESHOLD_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 4, label: "Strict", hint: "near-identical" },
  { value: 6, label: "Balanced", hint: "re-encoded / resized" },
  { value: 10, label: "Loose", hint: "aggressive — more, looser matches" },
];

export function NearDuplicatesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState<number>(6);
  const [lastBackfill, setLastBackfill] = useState<BackfillResult | null>(null);

  const { data: statusData, isLoading: isStatusLoading } = usePerceptualHashBackfillStatus();
  const { mutate: backfill, isPending: isBackfilling } = useBackfillPerceptualHashes();
  const { data: dupData, isLoading: isDupLoading } = useNearDuplicatePhotoGroups(threshold);
  const { mutate: deletePhoto, isPending: isDeleting } = useDeletePhoto();

  const missingCount = statusData?.missingCount ?? null;
  const groups = dupData?.groups ?? [];

  function refresh() {
    qc.invalidateQueries({ queryKey: getNearDuplicatePhotoGroupsQueryKey(threshold) });
    qc.invalidateQueries({ queryKey: ["admin", "photos", "perceptual-hash-backfill-status"] });
  }

  function handleBackfill() {
    setLastBackfill(null);
    backfill(undefined, {
      onSuccess: (result) => {
        setLastBackfill(result);
        if (result.processed === 0) {
          toast({ title: "All photos already have a perceptual hash" });
        } else if (result.failed === 0) {
          toast({ title: `Hashed ${result.updated} photo${result.updated !== 1 ? "s" : ""}` });
        } else {
          toast({
            title: "Perceptual hashing completed with some errors",
            description: `${result.updated} hashed, ${result.failed} failed`,
            variant: "destructive",
          });
        }
        refresh();
      },
      onError: () => toast({ title: "Perceptual hashing failed", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deletePhoto(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Photo deleted" });
          refresh();
        },
        onError: () => toast({ title: "Failed to delete photo", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="near-duplicates-section">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <CopyCheck className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Near-Duplicate Photos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find visually near-identical photos — re-encoded, resized or lightly edited copies that a byte-for-byte
            hash misses. Grouped by perceptual (dHash) similarity. Deletion is always a manual, per-photo action.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Perceptual-hash backfill: hashes must exist before matching can run. */}
        <div className="rounded-lg border border-border bg-background/40 px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Near-duplicate detection compares each photo's perceptual hash. Photos uploaded before this was added
            need their hash computed once.
          </p>
          <div className="text-sm" data-testid="perceptual-hash-status">
            {isStatusLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
              </span>
            ) : missingCount === 0 ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> All photos have a perceptual hash
              </span>
            ) : missingCount !== null ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                {missingCount} photo{missingCount !== 1 ? "s" : ""} not yet hashed
              </span>
            ) : null}
          </div>
          {lastBackfill && lastBackfill.processed > 0 && (
            <div className="text-xs text-muted-foreground">
              Hashed {lastBackfill.updated}, skipped {lastBackfill.skipped}, failed {lastBackfill.failed}
            </div>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleBackfill}
            disabled={isBackfilling}
            data-testid="backfill-perceptual-hashes-btn"
          >
            <CopyCheck className="h-4 w-4 mr-2" />
            {isBackfilling ? "Computing hashes…" : "Compute missing hashes"}
          </Button>
        </div>

        {/* Similarity threshold */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Sensitivity:</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5" role="group" data-testid="near-dup-threshold">
            {THRESHOLD_OPTIONS.map((opt) => {
              const active = threshold === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setThreshold(opt.value)}
                  aria-pressed={active}
                  title={opt.hint}
                  data-testid={`near-dup-threshold-${opt.value}`}
                  className={cn(
                    "h-6 rounded-md px-2.5 text-xs font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Near-duplicate groups */}
        {isDupLoading ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning for near-duplicates…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> No near-duplicate photos found at this sensitivity
          </div>
        ) : (
          <div className="space-y-5" data-testid="near-duplicate-groups">
            <p className="text-sm text-muted-foreground">
              {groups.length} near-duplicate group{groups.length !== 1 ? "s" : ""} found. Keep the copy you want and
              delete the rest. Album covers can't be deleted here — change the album's cover first.
            </p>
            {groups.map((group) => (
              <div key={group.key} className="rounded-lg border border-border p-3 space-y-2" data-testid={`near-duplicate-group-${group.key}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {group.photos.length} similar photo{group.photos.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground" title="Largest bit-distance within this group (0 = identical)">
                    {group.distance === 0 ? "identical" : `≤ ${group.distance} bits apart`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group.photos.map((photo) => (
                    <DuplicatePhotoCard key={photo.id} photo={photo} onDelete={handleDelete} deleting={isDeleting} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
