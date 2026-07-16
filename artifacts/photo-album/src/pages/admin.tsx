import { useGetMe } from "@workspace/api-client-react";
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
  Users,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// The hub deliberately runs NO queries (beyond the auth check): every section
// lives on its own /admin/<slug> page, so its status scans and library-wide
// queries only run when that page is opened.
const SECTIONS: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  { href: "/admin/registration", title: "Registration", description: "Allow or pause new account sign-ups.", icon: UserPlus },
  { href: "/admin/ai-services", title: "AI Services", description: "Providers, API keys, models, and analysis events.", icon: Bot },
  { href: "/admin/ai-analysis", title: "AI Analysis", description: "Backfill photo descriptions and monitor runs.", icon: Sparkles },
  { href: "/admin/embeddings", title: "Embeddings", description: "Semantic-search embeddings status and backfill.", icon: Braces },
  { href: "/admin/image-optimization", title: "Image Optimization", description: "Resize/compress settings for uploads.", icon: ImageDown },
  { href: "/admin/thumbnails", title: "Thumbnails", description: "Generate missing photo thumbnails.", icon: ImageIcon },
  { href: "/admin/captured-dates", title: "Captured Dates", description: "Fill missing capture dates from EXIF data.", icon: CalendarDays },
  { href: "/admin/duplicates", title: "Duplicates", description: "Byte-identical copies — review or bulk-delete extras.", icon: Copy },
  { href: "/admin/near-duplicates", title: "Near-Duplicates", description: "Visually similar photos — select and delete.", icon: CopyCheck },
  { href: "/admin/team", title: "Team Members", description: "Manage member roles.", icon: Users },
];

export default function Admin() {
  const { data: me, isLoading: meLoading } = useGetMe();

  if (meLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">You do not have permission to view this page.</p>
          <Link href="/dashboard"><Button variant="outline" className="mt-4">Back to Dashboard</Button></Link>
        </div>
      </AppLayout>
    );
  }

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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="admin-hub-grid">
          {SECTIONS.map((section) => {
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
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1">
                    {section.title}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
