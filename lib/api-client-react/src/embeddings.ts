import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type EmbeddingStatus = {
  enabled: boolean;
  projectConfigured: boolean;
  credentialsConfigured: boolean;
  model: string;
  location: string;
  embeddedCount: number;
  missingCount: number;
};

type BackfillEmbeddingsResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

const EMBEDDING_STATUS_KEY = ["admin", "embeddings", "status"] as const;

export function useEmbeddingStatus() {
  return useQuery({
    queryKey: EMBEDDING_STATUS_KEY,
    queryFn: () => customFetch<EmbeddingStatus>("/api/admin/embeddings/status"),
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

export function useBackfillEmbeddings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body?: { limit?: number }) =>
      customFetch<BackfillEmbeddingsResult>("/api/admin/embeddings/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMBEDDING_STATUS_KEY });
    },
  });
}
