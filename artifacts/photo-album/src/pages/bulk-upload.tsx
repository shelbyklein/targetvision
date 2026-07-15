import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Upload,
  ArrowLeft,
  History,
} from "lucide-react";
import {
  useListAlbums,
  getListAlbumsQueryKey,
  getListAlbumPhotosQueryKey,
  getGetAlbumQueryKey,
  useListBulkUploadBatches,
  getListBulkUploadBatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useBulkUpload } from "@/contexts/BulkUploadContext";
import type { GroupSpec } from "@/contexts/BulkUploadContext";
import type { FolderEntry, DuplicateFile } from "@/components/bulk-upload/types";
import { HistoryTab } from "@/components/bulk-upload/HistoryTab";
import { CompletePhase } from "@/components/bulk-upload/CompletePhase";
import { UploadingPhase } from "@/components/bulk-upload/UploadingPhase";
import { DuplicateCheckPhase } from "@/components/bulk-upload/DuplicateCheckPhase";
import { DropZone } from "@/components/bulk-upload/DropZone";
import { FolderList } from "@/components/bulk-upload/FolderList";
import { DestinationPanel } from "@/components/bulk-upload/DestinationPanel";
import { extractImagesFromZip } from "@/lib/extractImagesFromZip";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type LocalPhase = "staging" | "duplicate-check";

function deriveName(folders: FolderEntry[]): string {
  if (folders.length === 0) return "";
  if (folders.length === 1) return folders[0].name;
  const names = folders.map((f) => f.name);
  const prefix = names.reduce((acc, name) => {
    let i = 0;
    while (i < acc.length && i < name.length && acc[i] === name[i]) i++;
    return acc.slice(0, i);
  });
  return prefix.trim() || names[0];
}

async function readFilesFromEntry(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const files: File[] = [];
  const reader = entry.createReader();
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    for (const e of batch) {
      if (e.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (e as FileSystemFileEntry).file(resolve, reject)
        );
        if (file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE) {
          files.push(file);
        }
      }
    }
  } while (batch.length > 0);

  return files;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function BulkUpload() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: albums } = useListAlbums();
  const ctx = useBulkUpload();

  const [localPhase, setLocalPhase] = useState<LocalPhase>("staging");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [albumSearch, setAlbumSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");

  // Single destination for all folders
  const [destType, setDestType] = useState<"new" | "existing">("new");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [existingAlbumId, setExistingAlbumId] = useState<number | undefined>();

  const { data: batchHistory, isLoading: batchHistoryLoading } = useListBulkUploadBatches();

  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Auto-suggest album name from folder names (only if name is empty)
  useEffect(() => {
    if (destType === "new" && folders.length > 0) {
      setNewAlbumName((prev) => (prev.trim() ? prev : deriveName(folders)));
    }
  }, [folders, destType]);

  async function addFolders(newFolders: FolderEntry[]) {
    setFolders((prev) => [...prev, ...newFolders]);
  }

  async function addFoldersFromEntries(entries: FileSystemDirectoryEntry[]) {
    setIsProcessingDrop(true);
    const newFolders: FolderEntry[] = [];
    for (const entry of entries) {
      const files = await readFilesFromEntry(entry);
      if (files.length > 0) {
        newFolders.push({ id: genId(), name: entry.name, files });
      }
    }
    if (newFolders.length > 0) {
      await addFolders(newFolders);
    }
    setIsProcessingDrop(false);
  }

  async function addFoldersFromZip(zip: File) {
    setIsProcessingDrop(true);
    try {
      const newFolders = await extractImagesFromZip(zip);
      if (newFolders.length === 0) {
        toast({ title: "No images found in that .zip", variant: "destructive" });
        return;
      }
      await addFolders(newFolders);
    } catch {
      toast({ title: "Couldn't read that .zip file", variant: "destructive" });
    } finally {
      setIsProcessingDrop(false);
    }
  }

  async function handleZipInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await addFoldersFromZip(file);
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const dtFiles = Array.from(e.dataTransfer.files); // capture before any await
    const dirEntries: FileSystemDirectoryEntry[] = [];
    const zipEntries: FileSystemFileEntry[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) dirEntries.push(entry as FileSystemDirectoryEntry);
      else if (entry?.isFile && /\.zip$/i.test(entry.name)) zipEntries.push(entry as FileSystemFileEntry);
    }

    const zipFiles: File[] = [];
    for (const ze of zipEntries) {
      zipFiles.push(await new Promise<File>((resolve, reject) => ze.file(resolve, reject)));
    }
    if (dirEntries.length === 0 && zipFiles.length === 0) {
      for (const f of dtFiles) if (/\.zip$/i.test(f.name)) zipFiles.push(f);
    }

    if (dirEntries.length === 0 && zipFiles.length === 0) {
      toast({ title: "Drop folders or a .zip file", variant: "destructive" });
      return;
    }
    if (dirEntries.length > 0) await addFoldersFromEntries(dirEntries);
    for (const zip of zipFiles) await addFoldersFromZip(zip);
  }

  async function handleFolderInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const byFolder = new Map<string, File[]>();
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > MAX_FILE_SIZE) continue;
      const parts = (file.webkitRelativePath || file.name).split("/");
      const folderName = parts.length > 1 ? parts[0] : "(root)";
      if (!byFolder.has(folderName)) byFolder.set(folderName, []);
      byFolder.get(folderName)!.push(file);
    }

    const newFolders: FolderEntry[] = [];
    for (const [name, fls] of byFolder.entries()) {
      newFolders.push({ id: genId(), name, files: fls });
    }
    if (newFolders.length > 0) await addFolders(newFolders);
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function removeFolder(folderId: string) {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  }

  const totalPhotoCount = folders.reduce((sum, f) => sum + f.files.length, 0);

  const canStartUpload =
    folders.length > 0 &&
    (destType === "new"
      ? newAlbumName.trim().length > 0
      : existingAlbumId !== undefined);

  async function runDuplicateCheck(): Promise<DuplicateFile[]> {
    if (destType !== "existing" || !existingAlbumId) return [];

    const allFiles = folders.flatMap((f) =>
      f.files.map((file) => ({ file, folderId: f.id }))
    );

    try {
      const resp = await fetch(`/api/albums/${existingAlbumId}/photos/check-duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: allFiles.map(({ file }) => ({ name: file.name, size: file.size })),
        }),
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as {
        duplicates: Array<{ name: string; size: number; photoId: number }>;
      };
      const dupList: DuplicateFile[] = [];
      for (const dup of data.duplicates) {
        const match = allFiles.find(
          ({ file }) => file.name === dup.name && file.size === dup.size
        );
        if (match) {
          dupList.push({ name: dup.name, size: dup.size, folderId: match.folderId, skip: true });
        }
      }
      return dupList;
    } catch {
      return [];
    }
  }

  async function handleStartUpload() {
    const dups = await runDuplicateCheck();
    if (dups.length > 0) {
      setDuplicates(dups);
      setLocalPhase("duplicate-check");
      return;
    }
    await doStartQueue([]);
  }

  async function doStartQueue(dupOverrides: DuplicateFile[]) {
    const skipSet = new Set(
      dupOverrides
        .filter((d) => d.skip)
        .map((d) => `${d.folderId}::${d.name}::${d.size}`)
    );

    const folderFiles = new Map<string, File[]>();
    const folderNames = new Map<string, string>();
    for (const folder of folders) {
      folderFiles.set(folder.id, folder.files);
      folderNames.set(folder.id, folder.name);
    }

    const groupId = genId();
    const albumName =
      destType === "new"
        ? newAlbumName.trim()
        : albums?.find((a) => a.id === existingAlbumId)?.title ?? "Upload";

    const groupSpecs: GroupSpec[] = [
      {
        id: groupId,
        name: albumName,
        destType,
        existingAlbumId,
        folderIds: folders.map((f) => f.id),
      },
    ];

    const result = await ctx.startQueue(groupSpecs, folderFiles, folderNames, skipSet);
    if (!result.success) {
      toast({ title: result.error ?? "Upload failed", variant: "destructive" });
      return;
    }

    const albumIds = ctx.resolvedGroups.map((g) => g.albumId);
    qc.invalidateQueries({ queryKey: getListAlbumsQueryKey() });
    for (const albumId of albumIds) {
      qc.invalidateQueries({ queryKey: getGetAlbumQueryKey(albumId) });
      qc.invalidateQueries({ queryKey: getListAlbumPhotosQueryKey(albumId, {}) });
    }
    qc.invalidateQueries({ queryKey: getListBulkUploadBatchesQueryKey() });
  }

  function handleStartNewBatch() {
    ctx.resetQueue();
    setLocalPhase("staging");
    setFolders([]);
    setDuplicates([]);
    setDestType("new");
    setNewAlbumName("");
    setExistingAlbumId(undefined);
    setAlbumSearch("");
  }

  function toggleGroupExpand(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const filteredAlbums = albums?.filter((a) =>
    albumSearch.trim() ? a.title.toLowerCase().includes(albumSearch.toLowerCase()) : true
  );

  // ── Complete phase ──────────────────────────────────────────────────────────
  if (ctx.phase === "complete") {
    return (
      <CompletePhase
        queueFiles={ctx.queueFiles}
        resolvedGroups={ctx.resolvedGroups}
        canRetry={ctx.canRetry}
        orphanedCount={ctx.orphanedCount}
        onRetryFailed={ctx.retryFailed}
        onReattachAndRetry={ctx.reattachAndRetry}
        onNavigate={navigate}
        onStartNewBatch={handleStartNewBatch}
      />
    );
  }

  // ── Uploading phase ─────────────────────────────────────────────────────────
  if (ctx.phase === "uploading") {
    return (
      <UploadingPhase
        queueFiles={ctx.queueFiles}
        resolvedGroups={ctx.resolvedGroups}
        isPaused={ctx.isPaused}
        speedBps={ctx.speedBps}
        etaSeconds={ctx.etaSeconds}
        totalFiles={ctx.totalFiles}
        completedFiles={ctx.completedFiles}
        overallProgress={ctx.overallProgress}
        expandedGroups={expandedGroups}
        onTogglePause={ctx.togglePause}
        onCancelGroup={ctx.cancelGroup}
        onToggleGroupExpand={toggleGroupExpand}
      />
    );
  }

  // ── Duplicate check phase ───────────────────────────────────────────────────
  if (localPhase === "duplicate-check") {
    return (
      <DuplicateCheckPhase
        duplicates={duplicates}
        setDuplicates={setDuplicates}
        onBack={() => setLocalPhase("staging")}
        onContinue={() => doStartQueue(duplicates)}
      />
    );
  }

  // ── Staging phase ───────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/albums")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Albums
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Bulk Upload</h1>
            <p className="text-sm text-muted-foreground">
              Drop folders and choose where to upload them.
            </p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("upload")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
              activeTab === "upload" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
              activeTab === "history" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="h-3.5 w-3.5" />
            History
            {batchHistory && batchHistory.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                {batchHistory.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "history" && (
          <HistoryTab batches={batchHistory ?? []} isLoading={batchHistoryLoading} albums={albums ?? []} />
        )}

        {activeTab === "upload" && (
          <div className="space-y-5">
            {/* Drop zone */}
            <DropZone
              isDragOver={isDragOver}
              setIsDragOver={setIsDragOver}
              isProcessingDrop={isProcessingDrop}
              folderInputRef={folderInputRef}
              zipInputRef={zipInputRef}
              onDrop={handleDrop}
              onFolderInput={handleFolderInput}
              onZipInput={handleZipInput}
            />

            {/* Folder list */}
            {folders.length > 0 && (
              <FolderList
                folders={folders}
                totalPhotoCount={totalPhotoCount}
                onRemoveFolder={removeFolder}
              />
            )}

            {/* Single album destination — shown after folders are added */}
            {folders.length > 0 && (
              <DestinationPanel
                destType={destType}
                setDestType={setDestType}
                newAlbumName={newAlbumName}
                setNewAlbumName={setNewAlbumName}
                existingAlbumId={existingAlbumId}
                setExistingAlbumId={setExistingAlbumId}
                albumSearch={albumSearch}
                setAlbumSearch={setAlbumSearch}
                albums={albums}
                filteredAlbums={filteredAlbums}
              />
            )}

            {/* Start button */}
            {folders.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleStartUpload} disabled={!canStartUpload} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Start Upload ({totalPhotoCount} photo{totalPhotoCount !== 1 ? "s" : ""})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
