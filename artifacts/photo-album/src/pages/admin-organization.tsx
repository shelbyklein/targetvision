import { useEffect, useState } from "react";
import { useGetMe, useOrgDetails, useUpdateOrg } from "@workspace/api-client-react";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Loader2, Users, Hash, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format-date";

function Fact({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium truncate">{value}</span>
    </div>
  );
}

export default function AdminOrganizationPage() {
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: org, isLoading } = useOrgDetails();
  const { mutate: updateOrg, isPending: saving } = useUpdateOrg();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Seed the form once the org loads / changes.
  useEffect(() => {
    if (org) {
      setName(org.name);
      setDescription(org.description ?? "");
    }
  }, [org]);

  const canManage = me?.role === "admin" || org?.role === "owner" || org?.role === "admin";
  const dirty = !!org && (name.trim() !== org.name || (description.trim() || null) !== (org.description ?? null));

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    updateOrg(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => toast({ title: "Organization updated" }),
        onError: () => toast({ title: "Couldn't update the organization", variant: "destructive" }),
      },
    );
  }

  return (
    <AdminSectionShell
      title="Organization"
      icon={Building2}
      description="Details and settings for the organization you're currently working in."
    >
      {isLoading || !org ? (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-2.5">
            <Fact icon={Hash} label="Slug" value={org.slug} />
            <Fact icon={Users} label="Members" value={String(org.memberCount)} />
            <Fact icon={Calendar} label="Created" value={formatDate(org.createdAt)} />
          </div>

          <form onSubmit={handleSave} className="space-y-4" data-testid="org-settings-form">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={!canManage || saving}
                data-testid="org-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={canManage ? "What is this organization? (optional)" : "No description."}
                maxLength={500}
                rows={3}
                disabled={!canManage || saving}
                data-testid="org-description-input"
              />
            </div>
            {canManage && (
              <Button type="submit" size="sm" className="gap-1.5" disabled={saving || !dirty} data-testid="org-save-btn">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            )}
            {!canManage && (
              <p className="text-xs text-muted-foreground">Only an organization owner or admin can edit these.</p>
            )}
          </form>
        </div>
      )}
    </AdminSectionShell>
  );
}
