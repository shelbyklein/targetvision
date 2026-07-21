import { useState } from "react";
import { Link } from "wouter";
import { FadeImage } from "@/components/ui/fade-image";
import {
  useListProjects,
  useCreateProject,
  useReorderProjects,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useCardReorder } from "@/hooks/useCardReorder";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FolderKanban, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CreateProjectDialog({ onCreated, testId = "create-project-btn" }: { onCreated: () => void; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { mutate: createProject, isPending } = useCreateProject();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createProject(
      { data: { name: name.trim(), description: description.trim() || undefined } },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
          onCreated();
          toast({ title: "Project created", description: `"${name}" is ready.` });
        },
        onError: () => toast({ title: "Failed to create project", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid={testId}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring Catalog"
              required
              data-testid="project-name-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-desc">Description</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this project..."
              rows={3}
              data-testid="project-desc-input"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              data-testid="create-project-submit"
            >
              {isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useListProjects();

  function refetch() {
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  }

  const reorderMutation = useReorderProjects();
  const reorder = useCardReorder({
    ids: (projects ?? []).map((p) => p.id),
    onCommit: (orderedIds) =>
      reorderMutation.mutate({ data: { ids: orderedIds } }, { onSuccess: refetch }),
  });

  return (
    <AppLayout>
      <div className="space-y-6" data-testid="projects-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""} — gather photos for a specific deliverable
            </p>
          </div>
          <CreateProjectDialog onCreated={refetch} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-3 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="projects-grid">
            {reorder.arrange(projects, (p) => p.id).map((project) => (
              <div
                key={project.id}
                className={`relative group${reorder.draggingId === project.id ? " opacity-50" : ""}`}
                {...reorder.handlers(project.id)}
              >
                <Link href={`/projects/${project.id}`}>
                  <div
                    className="rounded-xl overflow-hidden border border-border bg-card cursor-pointer hover:shadow-md transition-shadow"
                    data-testid="project-card"
                  >
                    <div className="aspect-[4/3] bg-muted overflow-hidden">
                      {project.coverPhotoThumbnailKey || project.coverPhotoUrl ? (
                        <FadeImage
                          src={project.coverPhotoThumbnailKey ? `/api/storage${project.coverPhotoThumbnailKey}` : project.coverPhotoUrl!}
                          alt={project.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                          <FolderKanban className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-foreground text-sm truncate">{project.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {project.photoCount} photo{project.photoCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center py-24 text-center"
            data-testid="projects-empty"
          >
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderKanban className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create a project to gather photos for a deliverable and keep them in one place.
            </p>
            <CreateProjectDialog onCreated={refetch} testId="create-project-btn-empty" />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
