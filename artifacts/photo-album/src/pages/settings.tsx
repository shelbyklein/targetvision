import { AppLayout } from "@/components/layout/AppLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EyeOff } from "lucide-react";
import { useShowHiddenPhotos } from "@/hooks/use-show-hidden-photos";

export default function SettingsPage() {
  const { showHidden, setShowHidden } = useShowHiddenPhotos();

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-8" data-testid="settings-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal preferences for browsing photos.
          </p>
        </div>

        <Separator />

        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">Photo visibility</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="show-hidden-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                      Show hidden photos
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      When enabled, photos marked as hidden will appear in album views, search results,
                      and the photos browser with a "Hidden" badge. By default, hidden photos are not shown.
                    </p>
                  </div>
                </div>
                <Switch
                  id="show-hidden-toggle"
                  checked={showHidden}
                  onCheckedChange={setShowHidden}
                  data-testid="show-hidden-toggle"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
