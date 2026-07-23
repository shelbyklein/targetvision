import { Link } from "wouter";
import { useOnboardingStatus, useDismissOnboarding, useGetMe } from "@workspace/api-client-react";
import { useOrg } from "@/contexts/OrgContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CircleCheck, Circle, X, ChevronRight, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { key: string; label: string; href: string; done: boolean; managerOnly?: boolean };

// Dismissible "Getting started" checklist on the dashboard (#148). Steps are
// derived from real data server-side, so they complete themselves as the user
// acts. Auto-hides when dismissed or when every visible step is done.
export function GettingStartedCard() {
  const { data: status } = useOnboardingStatus();
  const { data: me } = useGetMe();
  const { activeOrg } = useOrg();
  const { mutate: dismiss, isPending: dismissing } = useDismissOnboarding();

  if (!status || status.dismissed) return null;

  const isManager =
    me?.role === "admin" || activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const steps: Step[] = [
    { key: "org", label: "Create your organization", href: "/admin/organization", done: true },
    { key: "photos", label: "Upload your first photos", href: "/bulk-upload", done: status.hasPhotos },
    { key: "album", label: "Create an album", href: "/albums", done: status.hasAlbums },
    { key: "collection", label: "Add photos to a collection", href: "/collections", done: status.hasCollectionPhotos },
    { key: "ai", label: "Configure an AI provider", href: "/admin/ai-services", done: status.aiConfigured, managerOnly: true },
    { key: "invite", label: "Invite a teammate", href: "/admin/members", done: status.invitedTeammate, managerOnly: true },
  ].filter((s) => isManager || !s.managerOnly);

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5" data-testid="getting-started-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
            <Rocket className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Getting started</h2>
            <p className="text-xs text-muted-foreground">
              {doneCount} of {steps.length} done — set up your photo library
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => dismiss()}
          disabled={dismissing}
          title="Dismiss"
          aria-label="Dismiss getting started checklist"
          data-testid="dismiss-getting-started"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <Progress value={(doneCount / steps.length) * 100} className="mt-3 h-1.5" />

      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.key}>
            {step.done ? (
              <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="line-through decoration-muted-foreground/40">{step.label}</span>
              </span>
            ) : (
              <Link
                href={step.href}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground",
                  "hover:bg-accent/60 transition-colors",
                )}
                data-testid={`getting-started-${step.key}`}
              >
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                {step.label}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
