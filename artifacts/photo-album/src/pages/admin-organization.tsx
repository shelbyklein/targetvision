import { useEffect, useRef, useState } from "react";
import { useGetMe, useOrgDetails, useUpdateOrg } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Loader2, Users, Hash, Calendar, Upload, Trash2 } from "lucide-react";
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
  const { uploadFile, isUploading } = useUpload();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Org logo (issue #121): upload through the standard presigned flow, then
  // persist the storage key on the org. Removal just nulls the key.
  async function handleLogoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (logoInputRef.current) logoInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Logos must be an image file", variant: "destructive" });
      return;
    }
    const uploaded = await uploadFile(file);
    if (!uploaded) {
      toast({ title: "Logo upload failed", variant: "destructive" });
      return;
    }
    updateOrg(
      { logoKey: uploaded.objectPath },
      {
        onSuccess: () => toast({ title: "Logo updated" }),
        onError: () => toast({ title: "Couldn't save the logo", variant: "destructive" }),
      },
    );
  }

  function handleLogoRemove() {
    updateOrg(
      { logoKey: null },
      {
        onSuccess: () => toast({ title: "Logo removed" }),
        onError: () => toast({ title: "Couldn't remove the logo", variant: "destructive" }),
      },
    );
  }

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
          {/* Logo (issue #121) */}
          <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4" data-testid="org-logo-section">
            <div className="h-16 w-16 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={`${org.name} logo`} className="h-full w-full object-cover" data-testid="org-logo-img" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Organization logo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shown in the sidebar org switcher. Square images look best.
              </p>
              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoPicked}
                    data-testid="org-logo-input"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={isUploading || saving}
                    onClick={() => logoInputRef.current?.click()}
                    data-testid="org-logo-upload-btn"
                  >
                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {org.logoUrl ? "Replace" : "Upload logo"}
                  </Button>
                  {org.logoUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground"
                      disabled={isUploading || saving}
                      onClick={handleLogoRemove}
                      data-testid="org-logo-remove-btn"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

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
