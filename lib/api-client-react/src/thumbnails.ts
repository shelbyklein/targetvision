import { useMutation } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { BackfillThumbnailsResult } from "./generated/api.schemas";

export function useBackfillThumbnails() {
  return useMutation({
    mutationFn: () =>
      customFetch<BackfillThumbnailsResult>("/api/admin/thumbnails/backfill", {
        method: "POST",
      }),
  });
}
