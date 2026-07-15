import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type ImageOptimizationStatus = {
  enabled: boolean;
  quality: number;
  maxEdge: number;
};

const IMAGE_OPTIMIZATION_STATUS_KEY = ["admin", "image-optimization", "status"] as const;

export function useImageOptimizationStatus() {
  return useQuery({
    queryKey: IMAGE_OPTIMIZATION_STATUS_KEY,
    queryFn: () => customFetch<ImageOptimizationStatus>("/api/admin/image-optimization/status"),
  });
}

export function useUpdateImageOptimizationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled: boolean }) =>
      customFetch<ImageOptimizationStatus>("/api/admin/image-optimization/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: IMAGE_OPTIMIZATION_STATUS_KEY });
    },
  });
}
