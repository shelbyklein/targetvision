import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

type BackfillExifDatesResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

const EXIF_DATE_BACKFILL_STATUS_KEY = ["admin", "photos", "exif-date-backfill-status"] as const;

export function useExifDateBackfillStatus() {
  return useQuery({
    queryKey: EXIF_DATE_BACKFILL_STATUS_KEY,
    queryFn: () =>
      customFetch<{ missingCount: number }>("/api/admin/photos/exif-date-backfill-status"),
  });
}

export function useBackfillExifDates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<BackfillExifDatesResult>("/api/admin/photos/exif-date-backfill", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXIF_DATE_BACKFILL_STATUS_KEY });
    },
  });
}
