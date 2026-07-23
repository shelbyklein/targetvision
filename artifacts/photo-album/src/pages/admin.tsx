import { useGetMe, useAdminHubStatus, type AdminHubStatus } from "@workspace/api-client-react";
import { useOrg } from "@/contexts/OrgContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  UserPlus,
  Bot,
  Sparkles,
  Braces,
  ImageDown,
  Image as ImageIcon,
  CalendarDays,
  Copy,
  CopyCheck,
  Copyright,
  Users,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  KeyRound,
  Building2,
  CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// The hub runs one aggregated count-only status call (see /admin/hub-status);
// each section's heavier scans still only run on its own /admin/<slug> page.
// `status` maps a hub-status count to the card's attention line; cards without
// a meaningful count (Registration, Users, ...) have none. Near-Duplicates is
// deliberately statusless — its clustering is too expensive for the hub.
type Section = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status?: { key: keyof AdminHubStatus; label: (n: number) => string };
};

// Platform level (issue #120): the operator's cross-org tools — every
// organization and every user on the platform, plus global sign-up policy.
const PLATFORM_SECTIONS: Section[] = [
  { href: "/admin/organizations", title: "Organizations", description: "All organizations — plans, usage, and support access.", icon: Building2 },
  { href: "/admin/team", title: "Users", description: "Every registered account and platform-admin roles.", icon: Users },
  { href: "/admin/registration", title: "Registration", description: "Allow or pause new account sign-ups.", icon: UserPlus },
];

// Org level: settings and maintenance scoped to the org you're currently in.
const ORG_SECTIONS: Section[] = [
  { href: "/admin/organization", title: "Organization", description: "Name, description, and details of your current organization.", icon: Building2 },
  { href: "/admin/members", title: "Members", description: "Invite teammates and manage roles in this organization.", icon: Users },
  { href: "/admin/billing", title: "Billing", description: "Plan, storage usage, and subscription for this organization.", icon: CreditCard },
  { href: "/admin/ai-services", title: "AI Services", description: "Providers, API keys, models, and analysis events.", icon: Bot },
  {
    href: "/admin/ai-analysis", title: "AI Analysis", description: "Backfill photo descriptions and monitor runs.", icon: Sparkles,
    status: { key: "aiAnalysisPending", label: (n) => `${n.toLocaleString()} photo${n !== 1 ? "s" : ""} not yet analysed` },
  },
  {
    href: "/admin/embeddings", title: "Embeddings", description: "Semantic-search embeddings status and backfill.", icon: Braces,
    status: { key: "embeddingsPending", label: (n) => `${n.toLocaleString()} pending` },
  },
  { href: "/admin/image-optimization", title: "Image Optimization", description: "Resize/compress settings for uploads.", icon: ImageDown },
  {
    href: "/admin/thumbnails", title: "Thumbnails", description: "Generate missing photo thumbnails.", icon: ImageIcon,
    status: { key: "thumbnailsMissing", label: (n) => `${n.toLocaleString()} missing` },
  },
  {
    href: "/admin/captured-dates", title: "Captured Dates", description: "Fill missing capture dates from EXIF data.", icon: CalendarDays,
    status: { key: "capturedDatesMissing", label: (n) => `${n.toLocaleString()} missing` },
  },
  {
    href: "/admin/duplicates", title: "Duplicates", description: "Byte-identical copies — review or bulk-delete extras.", icon: Copy,
    status: { key: "duplicateGroups", label: (n) => `${n.toLocaleString()} group${n !== 1 ? "s" : ""}` },
  },
  { href: "/admin/near-duplicates", title: "Near-Duplicates", description: "Visually similar photos — select and delete.", icon: CopyCheck },
  { href: "/admin/attribution-tags", title: "Attribution Tags", description: "Usage-rights tags photos can be cleared for.", icon: Copyright },
  { href: "/admin/mcp-tokens", title: "MCP Access Tokens", description: "Tokens for external AI clients to reach the photo library.", icon: KeyRound },
];

function CardStatus({
  count,
  label,
  loading,
}: {
  count: number | undefined;
  label: (n: number) => string;
  loading: boolean;
}) {
  if (loading || count == null) {
    return <Skeleton className="h-3.5 w-24 mt-1.5" />;
  }
  if (count === 0) {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500" data-testid="card-status-done">
        <CircleCheck className="h-3.5 w-3.5 shrink-0" />
        All done
      </p>
    );
  }
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500" data-testid="card-status-attention">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" />
      {label(count)}
    </p>
  );
}

export default function Admin() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const { activeOrg, isLoading: orgLoading } = useOrg();

  // Org owners/admins manage their organization; platform admins see everything
  // (issue #120). The hub-status call is org-scoped, so it's valid for both.
  const isPlatformAdmin = me?.role === "admin";
  const isOrgAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const allowed = isPlatformAdmin || isOrgAdmin;
  const { data: hubStatus, isLoading: statusLoading } = useAdminHubStatus({ enabled: allowed });

  if (meLoading || orgLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!me || !allowed) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
          <Link href="/dashboard"><Button variant="outline" className="mt-4">Back to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const groups = [
    ...(isPlatformAdmin
      ? ([["Platform", "Cross-organization tools for the Vispix operator.", PLATFORM_SECTIONS]] as const)
      : []),
    ["This organization", "Settings and maintenance for the organization you're currently in.", ORG_SECTIONS] as const,
  ];

  return (
    <AppLayout>
      <div className="space-y-8" data-testid="admin-page">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Each area opens on its own page.</p>
          </div>
        </div>

        {groups.map(([groupTitle, groupBlurb, sections]) => (
          <div key={groupTitle} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{groupTitle}</h2>
              <p className="text-xs text-muted-foreground/80 mt-0.5">{groupBlurb}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`admin-hub-grid-${groupTitle === "Platform" ? "platform" : "org"}`}>
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
                    data-testid={`admin-card-${section.href.split("/").pop()}`}
                  >
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-[18px] w-[18px] text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">
                        {section.title}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                      {section.status && (
                        <CardStatus
                          count={hubStatus?.[section.status.key]}
                          label={section.status.label}
                          loading={statusLoading}
                        />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
