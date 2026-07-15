import { useState } from "react";
import {
  useListUsers,
  useUpdateUserRole,
  getListUsersQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AiServicesSection } from "@/components/admin/AiServicesSection";
import { AiAnalysisBackfillSection } from "@/components/admin/AiAnalysisBackfillSection";
import { EmbeddingsSection } from "@/components/admin/EmbeddingsSection";
import { RegistrationSection } from "@/components/admin/RegistrationSection";
import { ThumbnailsSection } from "@/components/admin/ThumbnailsSection";
import { CapturedDatesSection } from "@/components/admin/CapturedDatesSection";
import { DuplicatesSection } from "@/components/admin/DuplicatesSection";
import { NearDuplicatesSection } from "@/components/admin/NearDuplicatesSection";

export default function Admin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading: meLoading } = useGetMe();
  const isAdmin = me?.role === "admin";
  const { data: users, isLoading: usersLoading } = useListUsers({
    query: { enabled: isAdmin, queryKey: getListUsersQueryKey() },
  });
  const { mutate: updateRole } = useUpdateUserRole();

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

  function handleRoleChange(userId: number, role: "admin" | "member") {
    updateRole(
      { id: userId, data: { role } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Role updated" });
        },
        onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
      }
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
            <p className="text-sm text-muted-foreground">Manage team member roles and AI services.</p>
          </div>
        </div>

        <RegistrationSection />

        <AiServicesSection />

        <AiAnalysisBackfillSection />

        <EmbeddingsSection />

        <ThumbnailsSection />

        <CapturedDatesSection />

        <DuplicatesSection />

        <NearDuplicatesSection />

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Team Members</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{users?.length ?? 0} members registered</p>
          </div>

          {usersLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-28" />
                </div>
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="divide-y divide-border" data-testid="users-list">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between px-5 py-3.5" data-testid={`user-row-${user.id}`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select
                      value={user.role}
                      onValueChange={(val) => handleRoleChange(user.id, val as "admin" | "member")}
                      disabled={user.id === me?.id}
                    >
                      <SelectTrigger className="h-8 w-28 text-sm" data-testid={`role-select-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {user.id === me?.id && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">No users yet.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
