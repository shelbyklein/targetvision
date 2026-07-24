import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export type AnalyticsPoint = { date: string; count: number };

// Platform-wide analytics for the operator (#155). Platform-admin only.
export type PlatformAnalytics = {
  windowDays: number;
  totals: {
    organizations: number;
    users: number;
    photos: number;
    storageBytes: number;
    activeUsers7d: number;
    activeUsers30d: number;
    mrrCents: number;
    canceledSubscriptions: number;
    planCounts: Record<string, number>;
  };
  series: {
    signups: AnalyticsPoint[];
    newOrgs: AnalyticsPoint[];
    uploads: AnalyticsPoint[];
    logins: AnalyticsPoint[];
    ratings: AnalyticsPoint[];
  };
};

export function usePlatformAnalytics(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["superadmin", "analytics"],
    queryFn: () => customFetch<PlatformAnalytics>("/api/superadmin/analytics"),
    enabled: options?.enabled ?? true,
  });
}
