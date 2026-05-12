import { useState } from "react";
import {
  useListUsers,
  useUpdateUserRole,
  useListCategories,
  useCreateCategory,
  useDeleteCategory,
  getListUsersQueryKey,
  getListCategoriesQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Plus, Trash2, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { AiServicesSection } from "@/components/admin/AiServicesSection";

export default function Admin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading: meLoading } = useGetMe();
  const isAdmin = me?.role === "admin";
  const { data: users, isLoading: usersLoading } = useListUsers({
    query: { enabled: isAdmin },
  });
  const { data: categories, isLoading: categoriesLoading } = useListCategories({
    query: { enabled: isAdmin },
  });
  const { mutate: updateRole } = useUpdateUserRole();
  const { mutate: createCategory, isPending: creating } = useCreateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();
  const [newCategoryName, setNewCategoryName] = useState("");

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

  function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    createCategory(
      { data: { name } },
      {
        onSuccess: () => {
          setNewCategoryName("");
          qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: `Category "${name}" created` });
        },
        onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
      }
    );
  }

  function handleDeleteCategory(id: number, name: string) {
    deleteCategory(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: `Category "${name}" deleted` });
        },
        onError: () => toast({ title: "Failed to delete category", variant: "destructive" }),
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
            <p className="text-sm text-muted-foreground">Manage team member roles and photo categories.</p>
          </div>
        </div>

        <AiServicesSection />

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Categories</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {categories?.length ?? 0} categor{categories?.length === 1 ? "y" : "ies"} — users can assign these to photos
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <form onSubmit={handleCreateCategory} className="flex gap-2" data-testid="create-category-form">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name..."
                className="h-9 text-sm"
                data-testid="category-name-input"
              />
              <Button
                type="submit"
                size="sm"
                className="gap-1.5 h-9"
                disabled={!newCategoryName.trim() || creating}
                data-testid="create-category-btn"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>

            {categoriesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-7 w-7 rounded" />
                  </div>
                ))}
              </div>
            ) : categories && categories.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden" data-testid="categories-list">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-3 py-2.5"
                    data-testid={`category-row-${cat.id}`}
                  >
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          data-testid={`delete-category-${cat.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the category from all photos. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="bg-destructive hover:bg-destructive/90"
                            data-testid={`confirm-delete-category-${cat.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground" data-testid="categories-empty">
                No categories yet. Add one above to get started.
              </div>
            )}
          </div>
        </div>

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
