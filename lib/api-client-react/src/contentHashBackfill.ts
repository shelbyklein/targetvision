import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

type BackfillContentHashesResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

const CONTENT_HASH_BACKFILL_STATUS_KEY = ["admin", "photos", "content-hash-backfill-status"] as const;

export function useContentHashBackfillStatus() {
  return useQuery({
    queryKey: CONTENT_HASH_BACKFILL_STATUS_KEY,
    queryFn: () =>
      customFetch<{ missingCount: number }>("/api/admin/photos/content-hash-backfill-status"),
  });
}

export function useBackfillContentHashes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<BackfillContentHashesResult>("/api/admin/photos/content-hash-backfill", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTENT_HASH_BACKFILL_STATUS_KEY });
    },
  });
}
