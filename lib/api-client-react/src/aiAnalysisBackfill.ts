import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

type BackfillAiAnalysisResult = {
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
};

export interface AiBackfillRun {
  id: number;
  trigger: "manual" | "automatic";
  requestedLimit: number | null;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  createdAt: string;
}

export interface AiAutoBackfillSettings {
  enabled: boolean;
  batchSize: number;
}

const AI_ANALYSIS_BACKFILL_STATUS_KEY = ["admin", "ai-analysis", "backfill-status"] as const;
const AI_ANALYSIS_BACKFILL_RUNS_KEY = ["admin", "ai-analysis", "backfill-runs"] as const;
const AI_AUTO_BACKFILL_SETTINGS_KEY = ["admin", "ai-analysis", "auto-backfill-settings"] as const;

export function useAiAnalysisBackfillStatus() {
  return useQuery({
    queryKey: AI_ANALYSIS_BACKFILL_STATUS_KEY,
    queryFn: () =>
      customFetch<{ missingCount: number }>("/api/admin/ai-analysis/backfill-status"),
  });
}

export function useAiAnalysisBackfillRuns() {
  return useQuery({
    queryKey: AI_ANALYSIS_BACKFILL_RUNS_KEY,
    queryFn: () => customFetch<AiBackfillRun[]>("/api/admin/ai-analysis/backfill-runs"),
  });
}

export function useBackfillAiAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { limit?: number }) =>
      customFetch<BackfillAiAnalysisResult>("/api/admin/ai-analysis/backfill", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ANALYSIS_BACKFILL_STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: AI_ANALYSIS_BACKFILL_RUNS_KEY });
    },
  });
}

export function useAiAutoBackfillSettings() {
  return useQuery({
    queryKey: AI_AUTO_BACKFILL_SETTINGS_KEY,
    queryFn: () =>
      customFetch<AiAutoBackfillSettings>("/api/admin/ai-analysis/auto-backfill-settings"),
  });
}

export function useUpdateAiAutoBackfillSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled?: boolean; batchSize?: number }) =>
      customFetch<AiAutoBackfillSettings>("/api/admin/ai-analysis/auto-backfill-settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_AUTO_BACKFILL_SETTINGS_KEY });
    },
  });
}
