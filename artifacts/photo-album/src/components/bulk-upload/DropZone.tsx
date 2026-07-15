import type { Dispatch, RefObject, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, FolderInput, FileArchive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  isDragOver: boolean;
  setIsDragOver: Dispatch<SetStateAction<boolean>>;
  isProcessingDrop: boolean;
  folderInputRef: RefObject<HTMLInputElement | null>;
  zipInputRef: RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onFolderInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function DropZone({
  isDragOver,
  setIsDragOver,
  isProcessingDrop,
  folderInputRef,
  zipInputRef,
  onDrop,
  onFolderInput,
  onZipInput,
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
          <p className="text-sm font-medium text-foreground">Reading contents…</p>
        </>
      ) : (
        <>
          <FolderInput className="h-9 w-9 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop folders or a .zip here</p>
            <p className="text-xs text-muted-foreground mt-1">Drag and drop one or more folders, or a .zip of folders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => folderInputRef.current?.click()}>
              <FolderOpen className="h-4 w-4" />
              Pick Folder
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => zipInputRef.current?.click()} data-testid="pick-zip-btn">
              <FileArchive className="h-4 w-4" />
              Upload .zip
            </Button>
          </div>
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            multiple
            className="hidden"
            onChange={onFolderInput}
          />
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={onZipInput}
            data-testid="zip-input"
          />
        </>
      )}
    </div>
  );
}
