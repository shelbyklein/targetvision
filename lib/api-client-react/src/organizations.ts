import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// One org the current user belongs to, with their role in it (issue #113).
export type MyOrganization = {
  id: number;
  name: string;
  slug: string;
  role: string; // "owner" | "admin" | "member"
};

const MY_ORGS_KEY = ["organizations", "mine"] as const;

export function useMyOrganizations() {
  return useQuery({
    queryKey: MY_ORGS_KEY,
    queryFn: () => customFetch<MyOrganization[]>("/api/organizations"),
    staleTime: 5 * 60 * 1000,
    // OrgProvider mounts above the auth gate, so this can fire while signed out
    // (401) — don't retry that.
    retry: false,
  });
}

// Persist the user's sticky active org server-side. The header the client sends
// is the source of truth per-request; this makes the choice survive a fresh
// session with no stored preference.
export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: number) =>
      customFetch<MyOrganization>("/api/organizations/switch", {
        method: "POST",
        body: JSON.stringify({ organizationId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_ORGS_KEY }),
  });
}
