import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { DuplicatePhoto } from "./generated/api.schemas";

type BackfillPerceptualHashesResult = {
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
};

// Near-duplicate group photos share the generated DuplicatePhoto shape so the
// admin UI can reuse the same photo card as the exact-duplicate section.
export type NearDuplicateGroup = {
  key: string;
  distance: number;
  photos: DuplicatePhoto[];
};

type NearDuplicatePhotoGroupsResult = {
  threshold: number;
  groups: NearDuplicateGroup[];
};

const PERCEPTUAL_HASH_BACKFILL_STATUS_KEY = ["admin", "photos", "perceptual-hash-backfill-status"] as const;

export function getNearDuplicatePhotoGroupsQueryKey(threshold: number) {
  return ["admin", "photos", "near-duplicates", threshold] as const;
}

export function usePerceptualHashBackfillStatus() {
  return useQuery({
    queryKey: PERCEPTUAL_HASH_BACKFILL_STATUS_KEY,
    queryFn: () =>
      customFetch<{ missingCount: number }>("/api/admin/photos/perceptual-hash-backfill-status"),
  });
}

export function useBackfillPerceptualHashes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<BackfillPerceptualHashesResult>("/api/admin/photos/perceptual-hash-backfill", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERCEPTUAL_HASH_BACKFILL_STATUS_KEY });
    },
  });
}

export function useNearDuplicatePhotoGroups(threshold: number) {
  return useQuery({
    queryKey: getNearDuplicatePhotoGroupsQueryKey(threshold),
    queryFn: () =>
      customFetch<NearDuplicatePhotoGroupsResult>(
        `/api/admin/photos/near-duplicates?threshold=${threshold}`,
      ),
  });
}
