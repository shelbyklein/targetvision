import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
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

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type LocalPhase = "staging" | "duplicate-check";

// Loose photos (picked or dropped as files, not folders) are grouped under
// this pseudo-folder name; it's excluded from album-name auto-suggestion.
const LOOSE_PHOTOS_GROUP = "Photos";

function deriveName(folders: FolderEntry[]): string {
  const named = folders.filter((f) => f.name !== LOOSE_PHOTOS_GROUP);
  if (named.length === 0) return "";
  if (named.length === 1) return named[0].name;
  const names = named.map((f) => f.name);
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
  const searchString = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: albums } = useListAlbums();
  const ctx = useBulkUpload();

  // When launched from an album page (/bulk-upload?albumId=N), assume that
  // album is the destination and preselect it.
  const presetAlbumId = (() => {
    const raw = new URLSearchParams(searchString.startsWith("?") ? searchString.slice(1) : searchString).get("albumId");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isInteger(n) && n > 0 ? n : undefined;
  })();

  const [localPhase, setLocalPhase] = useState<LocalPhase>("staging");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [albumSearch, setAlbumSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");

  // Single destination for all folders
  const [destType, setDestType] = useState<"new" | "existing">(presetAlbumId ? "existing" : "new");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [existingAlbumId, setExistingAlbumId] = useState<number | undefined>(presetAlbumId);

  const { data: batchHistory, isLoading: batchHistoryLoading } = useListBulkUploadBatches();

  const photoInputRef = useRef<HTMLInputElement>(null);

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

  // Merge loose image files into the single "Photos" pseudo-group (so picking
  // photos twice doesn't create two groups).
  function addLoosePhotos(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE);
    if (images.length === 0) return false;
    setFolders((prev) => {
      const existing = prev.find((f) => f.name === LOOSE_PHOTOS_GROUP);
      if (existing) {
        return prev.map((f) =>
          f.id === existing.id ? { ...f, files: [...f.files, ...images] } : f,
        );
      }
      return [...prev, { id: genId(), name: LOOSE_PHOTOS_GROUP, files: images }];
    });
    return true;
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const dtFiles = Array.from(e.dataTransfer.files); // capture before any await
    // Dropped folders still work — their images are harvested — but the
    // primary path is plain photo files. Zip support was removed (too fiddly).
    const dirEntries: FileSystemDirectoryEntry[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) dirEntries.push(entry as FileSystemDirectoryEntry);
    }

    const addedPhotos = addLoosePhotos(dtFiles);
    if (dirEntries.length > 0) await addFoldersFromEntries(dirEntries);
    if (!addedPhotos && dirEntries.length === 0) {
      toast({ title: "Drop photos here", description: "Image files (or a folder of them).", variant: "destructive" });
    }
  }

  function handlePhotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    addLoosePhotos(Array.from(e.target.files ?? []));
    if (photoInputRef.current) photoInputRef.current.value = "";
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
            <h1 className="text-xl font-bold text-foreground">Upload</h1>
            <p className="text-sm text-muted-foreground">
              Drop photos and choose where to upload them.
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
              photoInputRef={photoInputRef}
              onDrop={handleDrop}
              onPhotoInput={handlePhotoInput}
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
