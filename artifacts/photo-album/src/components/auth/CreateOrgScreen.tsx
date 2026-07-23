import { useState, type FormEvent } from "react";
import { useCreateOrganization } from "@workspace/api-client-react";
import { setActiveOrgId } from "@/lib/active-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Loader2 } from "lucide-react";

// Shown to a signed-in user who belongs to no organization yet (issue #113) —
// e.g. a fresh sign-up. Creating one enrolls them as its owner and drops them
// into the app.
export function CreateOrgScreen() {
  const { mutate, isPending, isError } = useCreateOrganization();
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    mutate(trimmed, {
      // Target the new org immediately; the invalidated org list then re-renders
      // OrgProvider into the app.
      onSuccess: (org) => setActiveOrgId(org.id),
    });
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6" data-testid="create-org-screen">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to Vispix</h1>
          <p className="text-sm text-muted-foreground">
            Vispix is your team's photo library — upload event photos, rate and curate the best,
            and find anything with AI search. Start by naming your organization; you'll be its owner
            and can invite teammates later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" data-testid="create-org-form">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name (e.g. USA Archery)"
            maxLength={80}
            autoFocus
            disabled={isPending}
            data-testid="create-org-name"
          />
          {isError && (
            <p className="text-sm text-destructive" data-testid="create-org-error">
              Couldn't create the organization. Please try again.
            </p>
          )}
          <Button type="submit" className="w-full gap-2" disabled={isPending || !name.trim()} data-testid="create-org-submit">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create organization
          </Button>
        </form>
      </div>
    </div>
  );
}
