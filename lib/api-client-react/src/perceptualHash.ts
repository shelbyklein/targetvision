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
  totalGroups: number;
  hasMore: boolean;
  groups: NearDuplicateGroup[];
};

export type NearDuplicatePhotoGroupsParams = {
  threshold: number;
  limit?: number;
  offset?: number;
};

const PERCEPTUAL_HASH_BACKFILL_STATUS_KEY = ["admin", "photos", "perceptual-hash-backfill-status"] as const;

export function getNearDuplicatePhotoGroupsQueryKey(params: NearDuplicatePhotoGroupsParams) {
  return ["admin", "photos", "near-duplicates", params.threshold, params.limit ?? null, params.offset ?? null] as const;
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

const NEAR_DUP_INDEX_STATUS_KEY = ["admin", "photos", "near-duplicate-index-status"] as const;

export function getNearDuplicateIndexStatusQueryKey() {
  return NEAR_DUP_INDEX_STATUS_KEY;
}

export function useNearDuplicateIndexStatus() {
  return useQuery({
    queryKey: NEAR_DUP_INDEX_STATUS_KEY,
    queryFn: () =>
      customFetch<{ pairCount: number; hashedPhotos: number }>(
        "/api/admin/photos/near-duplicate-index-status",
      ),
  });
}

export function useRebuildNearDuplicateIndex() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<{ photos: number; pairs: number }>("/api/admin/photos/near-duplicate-index/rebuild", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEAR_DUP_INDEX_STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin", "photos", "near-duplicates"] });
    },
  });
}

export function useNearDuplicatePhotoGroups(params: NearDuplicatePhotoGroupsParams) {
  const search = new URLSearchParams({ threshold: String(params.threshold) });
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  return useQuery({
    queryKey: getNearDuplicatePhotoGroupsQueryKey(params),
    queryFn: () =>
      customFetch<NearDuplicatePhotoGroupsResult>(
        `/api/admin/photos/near-duplicates?${search.toString()}`,
      ),
  });
}
