import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type AdminHubStatus = {
  aiAnalysisPending: number;
  embeddingsPending: number;
  thumbnailsMissing: number;
  capturedDatesMissing: number;
  duplicateGroups: number;
};

/** At-a-glance counts for the admin hub cards (one aggregated cheap call). */
export function useAdminHubStatus(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["admin", "hub-status"],
    queryFn: () => customFetch<AdminHubStatus>("/api/admin/hub-status"),
    enabled: opts.enabled ?? true,
  });
}
