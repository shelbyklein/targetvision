import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// Platform superadmin (issue #120): the operator's cross-org overview.
export type AdminOrgMember = { userId: number; name: string; email: string; role: string };
export type AdminOrganization = {
  id: number;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  memberCount: number;
  photoCount: number;
  usageBytes: number;
  capBytes: number | null; // null = unlimited
  createdAt: string;
  myRole: string | null; // the caller's membership in this org, if any
  members: AdminOrgMember[];
};

const ADMIN_ORGS_KEY = ["admin", "organizations"] as const;

export function useAdminOrganizations(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ADMIN_ORGS_KEY,
    queryFn: () => customFetch<AdminOrganization[]>("/api/admin/organizations"),
    enabled: opts.enabled ?? true,
  });
}

// Join-on-demand support access: adds the platform admin to the org as an
// org-admin (visible in the customer's member list). Invalidates both the
// overview and the caller's own org list so the org switcher picks it up.
export function useJoinOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: number) =>
      customFetch<{ organizationId: number; role: string; alreadyMember: boolean }>(
        `/api/admin/organizations/${organizationId}/join`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ORGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["organizations", "mine"] });
    },
  });
}

// Platform-level org-role change: set any member's role in any org without
// being inside it (last-owner demotion is refused server-side).
export function useAdminSetOrgMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: number; userId: number; role: "owner" | "admin" | "member" }) =>
      customFetch<void>(`/api/admin/organizations/${input.organizationId}/members/${input.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: input.role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ORGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["organizations", "members"] });
    },
  });
}

// Platform-admin plan override (billing #118's set-plan route).
export function useSetOrgPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: number; plan: "free" | "pro" | "enterprise" }) =>
      customFetch<unknown>("/api/billing/admin/set-plan", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ORGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["billing", "status"] });
    },
  });
}

// Platform service readiness (issue #122): per-service status + overall flag.
export type ServiceStatus = {
  ready: boolean;
  services: { key: string; label: string; ok: boolean; optional: boolean; detail: string }[];
};

export function useServiceStatus(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["admin", "service-status"],
    queryFn: () => customFetch<ServiceStatus>("/api/admin/service-status"),
    enabled: opts.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

// Org-scoped readiness (issue #122): same shape, but the AI row reflects
// whether the ACTIVE org can analyse photos. Accessible to org owners/admins.
export function useOrgServiceStatus(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["admin", "org-service-status"],
    queryFn: () => customFetch<ServiceStatus>("/api/admin/org-service-status"),
    enabled: opts.enabled ?? true,
    staleTime: 60 * 1000,
  });
}
