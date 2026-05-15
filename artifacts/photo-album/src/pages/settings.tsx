import { AppLayout } from "@/components/layout/AppLayout";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";

export default function SettingsPage() {
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

        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Settings className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">
            Per-page show/hide toggles are now available inline on the Photos and Search pages.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
