import type { CollectionSummary, Collection, Project } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, FolderOpen, FolderKanban, Loader2, Plus } from "lucide-react";

export function CollectionsPanel({
  photoCollections,
  availableCollections,
  projects,
  newCollectionName,
  setNewCollectionName,
  creatingCollection,
  onAddCollection,
  onRemoveFromCollection,
  onCreateNewCollection,
  onAddProject,
}: {
  photoCollections?: CollectionSummary[];
  availableCollections?: Collection[];
  projects?: Project[];
  newCollectionName: string;
  setNewCollectionName: (value: string) => void;
  creatingCollection: boolean;
  onAddCollection: (collectionId: string) => void;
  onRemoveFromCollection: (collectionId: number) => void;
  onCreateNewCollection: (e: React.FormEvent) => void;
  onAddProject: (projectId: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Collections
        </Label>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]" data-testid="photo-collections">
          {photoCollections?.map((col) => (
            <Badge key={col.id} variant="outline" className="gap-1 pr-1">
              <Link href={`/collections/${col.id}`} className="hover:underline">
                {col.title}
              </Link>
              <button
                onClick={() => onRemoveFromCollection(col.id)}
                className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                data-testid={`remove-collection-${col.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {(!photoCollections || photoCollections.length === 0) && (
            <span className="text-xs text-muted-foreground">Not in any collection</span>
          )}
        </div>
        {availableCollections && availableCollections.length > 0 && (
          <Select onValueChange={onAddCollection} data-testid="add-collection-select">
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue placeholder="Add to collection..." />
            </SelectTrigger>
            <SelectContent>
              {availableCollections.map((col) => (
                <SelectItem key={col.id} value={String(col.id)} data-testid={`collection-option-${col.id}`}>
                  {col.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <form
          onSubmit={onCreateNewCollection}
          className="flex gap-1.5"
          data-testid="create-collection-form"
        >
          <Input
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="New collection name..."
            className="h-8 text-sm flex-1"
            disabled={creatingCollection}
            data-testid="new-collection-name-input"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 px-2.5 gap-1"
            disabled={creatingCollection || !newCollectionName.trim()}
            data-testid="create-collection-submit"
          >
            {creatingCollection ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create
          </Button>
        </form>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5" />
          Projects
        </Label>
        {projects && projects.length > 0 ? (
          <Select onValueChange={onAddProject} data-testid="add-project-select">
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue placeholder="Add to project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={String(proj.id)} data-testid={`project-option-${proj.id}`}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground">
            No projects yet.{" "}
            <Link href="/projects" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        )}
      </div>
    </>
  );
}
