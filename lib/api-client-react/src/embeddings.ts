import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// Live/last state of the cancellable backfill job (#31).
export type EmbeddingJob = {
  running: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  stopped: boolean;
  startedAt: string;
  finishedAt: string | null;
};

export type EmbeddingStatus = {
  enabled: boolean;
  projectConfigured: boolean;
  credentialsConfigured: boolean;
  model: string;
  location: string;
  embeddedCount: number;
  missingCount: number;
  job: EmbeddingJob | null;
};

const EMBEDDING_STATUS_KEY = ["admin", "embeddings", "status"] as const;

// Poll faster while a backfill job is in flight so the count feels live.
export function useEmbeddingStatus(options?: { pollWhileRunning?: boolean }) {
  return useQuery({
    queryKey: EMBEDDING_STATUS_KEY,
    queryFn: () => customFetch<EmbeddingStatus>("/api/admin/embeddings/status"),
    refetchInterval: (query) =>
      options?.pollWhileRunning && query.state.data?.job?.running ? 1500 : false,
  });
}

export function useUpdateEmbeddingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled: boolean }) =>
      customFetch<EmbeddingStatus>("/api/admin/embeddings/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMBEDDING_STATUS_KEY });
    },
  });
}

// Start the background backfill; returns the status with the freshly-started job.
export function useBackfillEmbeddings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { limit?: number }) =>
      customFetch<EmbeddingStatus>("/api/admin/embeddings/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: (data) => queryClient.setQueryData(EMBEDDING_STATUS_KEY, data),
  });
}

// Request a clean halt of the running backfill.
export function useStopEmbeddingBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<EmbeddingStatus>("/api/admin/embeddings/backfill/stop", { method: "POST" }),
    onSuccess: (data) => queryClient.setQueryData(EMBEDDING_STATUS_KEY, data),
  });
}
