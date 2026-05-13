import {
  useGetRegistrationSettings,
  useUpdateRegistrationSettings,
  getGetRegistrationSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function RegistrationSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetRegistrationSettings();
  const { mutate: updateSettings, isPending } = useUpdateRegistrationSettings();

  function handleToggle(enabled: boolean) {
    updateSettings(
      { data: { registrationEnabled: enabled } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetRegistrationSettingsQueryKey() });
          toast({
            title: enabled
              ? "Public sign-up enabled"
              : "Public sign-up disabled",
          });
        },
        onError: () =>
          toast({ title: "Failed to update registration setting", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="registration-section">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Registration</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Control whether new users can self-register</p>
        </div>
      </div>

      <div className="px-5 py-4">
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Switch
              id="registration-toggle"
              checked={settings?.registrationEnabled ?? true}
              onCheckedChange={handleToggle}
              disabled={isPending}
              data-testid="registration-toggle"
            />
            <Label htmlFor="registration-toggle" className="text-sm text-foreground cursor-pointer">
              {settings?.registrationEnabled
                ? "Public sign-up is enabled — anyone can create an account"
                : "Public sign-up is disabled — only invited users can sign in"}
            </Label>
          </div>
        )}
      </div>
    </div>
  );
}
