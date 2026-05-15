import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { BackfillThumbnailsResult } from "./generated/api.schemas";

const BACKFILL_STATUS_KEY = ["admin", "thumbnails", "backfill-status"] as const;

export function useBackfillThumbnailsStatus() {
  return useQuery({
    queryKey: BACKFILL_STATUS_KEY,
    queryFn: () =>
      customFetch<{ missingCount: number }>("/api/admin/thumbnails/backfill-status"),
  });
}

export function useBackfillThumbnails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<BackfillThumbnailsResult>("/api/admin/thumbnails/backfill", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKFILL_STATUS_KEY });
    },
  });
}
