import { useServiceStatus, useOrgServiceStatus } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleCheck, CircleAlert, CircleMinus } from "lucide-react";

// Per-service readiness rows + overall checkmark (issue #122). Two variants:
// "platform" (superadmin hub — AI = any org) and "org" (org admin hub — AI =
// the active org's own configuration).
export function ServiceReadinessCard({
  variant,
  enabled,
}: {
  variant: "platform" | "org";
  enabled: boolean;
}) {
  const platform = useServiceStatus({ enabled: enabled && variant === "platform" });
  const org = useOrgServiceStatus({ enabled: enabled && variant === "org" });
  const { data, isLoading } = variant === "platform" ? platform : org;

  if (isLoading || !data) {
    return <Skeleton className="h-24 w-full rounded-xl" data-testid="service-readiness-loading" />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="service-readiness">
      <div className="flex items-center gap-2">
        {data.ready ? (
          <CircleCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
        ) : (
          <CircleAlert className="h-5 w-5 text-amber-500 shrink-0" />
        )}
        <h3 className="text-sm font-semibold text-foreground">
          {data.ready
            ? variant === "platform"
              ? "Platform ready — all required services configured"
              : "Everything's configured — this organization is ready"
            : "Setup incomplete"}
        </h3>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {data.services.map((s) => (
          <div key={s.key} className="flex items-start gap-1.5 text-xs" data-testid={`service-${s.key}`}>
            {s.ok ? (
              <CircleCheck className="h-3.5 w-3.5 mt-0.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
            ) : s.optional ? (
              <CircleMinus className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            ) : (
              <CircleAlert className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
            )}
            <span>
              <span className="font-medium text-foreground">
                {s.label}
                {s.optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
              </span>{" "}
              <span className="text-muted-foreground">— {s.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
