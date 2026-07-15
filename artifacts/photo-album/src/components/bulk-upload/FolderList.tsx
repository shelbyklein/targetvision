import { FolderOpen, Trash2 } from "lucide-react";
import type { FolderEntry } from "./types";

interface FolderListProps {
  folders: FolderEntry[];
  totalPhotoCount: number;
  onRemoveFolder: (folderId: string) => void;
}

export function FolderList({ folders, totalPhotoCount, onRemoveFolder }: FolderListProps) {
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between bg-muted/30">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {folders.length} folder{folders.length !== 1 ? "s" : ""} · {totalPhotoCount} photos
        </span>
      </div>
      {folders.map((folder) => (
        <div key={folder.id} className="px-4 py-3 flex items-center gap-3">
          <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{folder.name}</p>
            <p className="text-xs text-muted-foreground">{folder.files.length} photo{folder.files.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => onRemoveFolder(folder.id)}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
            title="Remove folder"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
