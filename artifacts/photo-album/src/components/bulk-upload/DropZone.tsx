import type { Dispatch, RefObject, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, FolderInput, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  isDragOver: boolean;
  setIsDragOver: Dispatch<SetStateAction<boolean>>;
  isProcessingDrop: boolean;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onFolderInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function DropZone({
  isDragOver,
  setIsDragOver,
  isProcessingDrop,
  folderInputRef,
  onDrop,
  onFolderInput,
}: DropZoneProps) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "relative border-2 border-dashed rounded-xl py-10 flex flex-col items-center justify-center gap-3 transition-colors cursor-default",
        isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
      )}
    >
      {isProcessingDrop ? (
        <>
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">Reading folder contents…</p>
        </>
      ) : (
        <>
          <FolderInput className="h-9 w-9 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop folders here</p>
            <p className="text-xs text-muted-foreground mt-1">Drag and drop one or more folders at once</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => folderInputRef.current?.click()}>
            <FolderOpen className="h-4 w-4" />
            Pick Folder
          </Button>
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            multiple
            className="hidden"
            onChange={onFolderInput}
          />
        </>
      )}
    </div>
  );
}
