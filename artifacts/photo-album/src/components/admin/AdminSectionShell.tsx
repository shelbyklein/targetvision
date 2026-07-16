import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Shared wrapper for the per-section admin pages: admin guard, back link to
// the /admin hub, and a consistent header. Keeps each page a thin wrapper
// around its section component.
export function AdminSectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
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
      <div className="space-y-6" data-testid={`admin-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <div className="flex items-start gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" data-testid="back-to-admin">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
              {title}
            </h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        </div>
        {children}
      </div>
    </AppLayout>
  );
}
