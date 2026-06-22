import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FolderOpen,
  FolderInput,
  Trash2,
  ChevronDown,
  ChevronRight,
  Upload,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Link as LinkIcon,
  RefreshCw,
  History,
  Clock,
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

const MAX_FILE_SIZE = 100 * 1024 * 1024;

type LocalPhase = "staging" | "duplicate-check";

interface FolderEntry {
  id: string;
  name: string;
  files: File[];
  groupId: string | null;
}

interface Group {
  id: string;
  folderIds: string[];
  destType: "new" | "existing";
  existingAlbumId?: number;
  newAlbumName: string;
}

interface DuplicateFile {
  name: string;
  size: number;
  groupId: string;
  folderId: string;
  skip: boolean;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function humanSpeed(bps: number): string {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function deriveGroupName(folders: FolderEntry[]): string {
  if (folders.length === 0) return "New Album";
  if (folders.length === 1) return folders[0].name;
  const names = folders.map((f) => f.name);
  const prefix = names.reduce((acc, name) => {
    let i = 0;
    while (i < acc.length && i < name.length && acc[i] === name[i]) i++;
    return acc.slice(0, i);
  });
  return prefix.trim() || names[0];
}

async function readFilesFromEntry(
  entry: FileSystemDirectoryEntry
): Promise<File[]> {
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [albumSearch, setAlbumSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");

  const { data: batchHistory, isLoading: batchHistoryLoading } = useListBulkUploadBatches();

  const folderInputRef = useRef<HTMLInputElement>(null);

  function autoGroupNewFolders(newFolders: FolderEntry[]) {
    setGroups((prev) => {
      const next = [...prev];
      for (const folder of newFolders) {
        const gId = genId();
        next.push({
          id: gId,
          folderIds: [folder.id],
          destType: "new",
          newAlbumName: folder.name,
        });
        folder.groupId = gId;
      }
      return next;
    });
  }

  async function addFoldersFromEntries(entries: FileSystemDirectoryEntry[]) {
    setIsProcessingDrop(true);
    const newFolders: FolderEntry[] = [];
    for (const entry of entries) {
      const files = await readFilesFromEntry(entry);
      if (files.length > 0) {
        newFolders.push({ id: genId(), name: entry.name, files, groupId: null });
      }
    }
    if (newFolders.length > 0) {
      setFolders((prev) => [...prev, ...newFolders]);
      autoGroupNewFolders(newFolders);
    }
    setIsProcessingDrop(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const entries: FileSystemDirectoryEntry[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) entries.push(entry as FileSystemDirectoryEntry);
    }
    if (entries.length === 0) {
      toast({ title: "Drop folders, not individual files", variant: "destructive" });
      return;
    }
    await addFoldersFromEntries(entries);
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
      newFolders.push({ id: genId(), name, files: fls, groupId: null });
    }

    if (newFolders.length > 0) {
      setFolders((prev) => [...prev, ...newFolders]);
      autoGroupNewFolders(newFolders);
    }
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function removeFolder(folderId: string) {
    setFolders((prev) => {
      const folder = prev.find((f) => f.id === folderId);
      if (!folder) return prev;
      if (folder.groupId) {
        setGroups((prevG) =>
          prevG
            .map((g) =>
              g.id === folder.groupId
                ? { ...g, folderIds: g.folderIds.filter((id) => id !== folderId) }
                : g
            )
            .filter((g) => g.folderIds.length > 0)
        );
      }
      return prev.filter((f) => f.id !== folderId);
    });
  }

  function mergeFolderIntoGroup(folderId: string, targetGroupId: string) {
    setFolders((prev) => {
      const folder = prev.find((f) => f.id === folderId);
      if (!folder) return prev;
      const oldGroupId = folder.groupId;
      setGroups((prevG) =>
        prevG
          .map((g) => {
            if (g.id === oldGroupId)
              return { ...g, folderIds: g.folderIds.filter((id) => id !== folderId) };
            if (g.id === targetGroupId)
              return { ...g, folderIds: [...g.folderIds, folderId] };
            return g;
          })
          .filter((g) => g.folderIds.length > 0)
      );
      return prev.map((f) => (f.id === folderId ? { ...f, groupId: targetGroupId } : f));
    });
  }

  function updateGroup(groupId: string, patch: Partial<Group>) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }

  function removeGroup(groupId: string) {
    const groupFolderIds = groups.find((g) => g.id === groupId)?.folderIds ?? [];
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setFolders((prev) =>
      prev.map((f) => (groupFolderIds.includes(f.id) ? { ...f, groupId: null } : f))
    );
    for (const folderId of groupFolderIds) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) {
        const newGroupId = genId();
        setGroups((prev) => [
          ...prev,
          { id: newGroupId, folderIds: [folderId], destType: "new", newAlbumName: folder.name },
        ]);
        setFolders((prev) =>
          prev.map((f) => (f.id === folderId ? { ...f, groupId: newGroupId } : f))
        );
      }
    }
  }

  function toggleGroupExpand(groupId: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const canStartUpload =
    groups.length > 0 &&
    groups.every((g) =>
      g.destType === "new"
        ? g.newAlbumName.trim().length > 0
        : g.existingAlbumId !== undefined
    );

  async function runDuplicateCheck(): Promise<DuplicateFile[]> {
    const dupList: DuplicateFile[] = [];
    for (const group of groups) {
      const albumId =
        group.destType === "existing" && group.existingAlbumId ? group.existingAlbumId : null;
      if (!albumId) continue;

      const groupFolders = folders.filter((f) => group.folderIds.includes(f.id));
      const allFiles = groupFolders.flatMap((f) => f.files.map((file) => ({ file, folderId: f.id })));

      try {
        const resp = await fetch(`/api/albums/${albumId}/photos/check-duplicates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: allFiles.map(({ file }) => ({ name: file.name, size: file.size })),
          }),
        });
        if (!resp.ok) continue;
        const data = (await resp.json()) as {
          duplicates: Array<{ name: string; size: number; photoId: number }>;
        };
        for (const dup of data.duplicates) {
          const match = allFiles.find(
            ({ file }) => file.name === dup.name && file.size === dup.size
          );
          if (match) {
            dupList.push({
              name: dup.name,
              size: dup.size,
              groupId: group.id,
              folderId: match.folderId,
              skip: true,
            });
          }
        }
      } catch {}
    }
    return dupList;
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

    const groupSpecs: GroupSpec[] = groups.map((g) => ({
      id: g.id,
      name: g.destType === "new" ? g.newAlbumName.trim() : deriveGroupName(folders.filter((f) => g.folderIds.includes(f.id))),
      destType: g.destType,
      existingAlbumId: g.existingAlbumId,
      folderIds: g.folderIds,
    }));

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
    setGroups([]);
    setDuplicates([]);
    setExpandedGroups(new Set());
  }

  const filteredAlbums = albums?.filter((a) =>
    albumSearch.trim() ? a.title.toLowerCase().includes(albumSearch.toLowerCase()) : true
  );

  if (ctx.phase === "complete") {
    const { queueFiles, resolvedGroups, canRetry } = ctx;
    const totalDone = queueFiles.filter((f) => f.status === "done").length;
    const totalFailed = queueFiles.filter((f) => f.status === "error").length;
    const totalSkipped = queueFiles.filter((f) => f.status === "skipped").length;
    const totalCancelled = queueFiles.filter((f) => f.status === "cancelled").length;

    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/albums")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Albums
            </Button>
          </div>

          <div className="text-center py-8 space-y-3">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Upload Complete</h1>
            <p className="text-muted-foreground text-sm">
              {totalDone} photo{totalDone !== 1 ? "s" : ""} uploaded
              {totalSkipped > 0 && `, ${totalSkipped} skipped`}
              {totalFailed > 0 && `, ${totalFailed} failed`}
              {totalCancelled > 0 && `, ${totalCancelled} cancelled`}
            </p>
            {canRetry && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => ctx.retryFailed()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry {totalFailed} failed
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {resolvedGroups.map((group) => {
              const groupFiles = queueFiles.filter((f) => f.groupId === group.id);
              const done = groupFiles.filter((f) => f.status === "done").length;
              const failed = groupFiles.filter((f) => f.status === "error").length;
              const cancelled = groupFiles.filter((f) => f.status === "cancelled").length;
              const hasGroupErrors = failed > 0 && canRetry;

              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {done} uploaded
                      {failed > 0 && `, ${failed} failed`}
                      {cancelled > 0 && `, ${cancelled} cancelled`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasGroupErrors && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => ctx.retryFailed(group.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry {failed}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/albums/${group.albumId}`}>
                        <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                        View Album
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate("/albums")}>
              Back to Albums
            </Button>
            <Button onClick={handleStartNewBatch}>Start New Batch</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (ctx.phase === "uploading") {
    const {
      queueFiles,
      resolvedGroups,
      isPaused,
      speedBps,
      etaSeconds,
      totalFiles,
      completedFiles,
      overallProgress,
    } = ctx;

    type GroupStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";
    function getGroupStatus(groupId: string): GroupStatus {
      const files = queueFiles.filter((f) => f.groupId === groupId);
      if (files.length === 0) return "queued";
      if (files.every((f) => f.status === "pending" || f.status === "skipped")) return "queued";
      if (files.some((f) => f.status === "uploading")) return "uploading";
      const terminal = files.every(
        (f) =>
          f.status === "done" ||
          f.status === "error" ||
          f.status === "skipped" ||
          f.status === "cancelled"
      );
      if (terminal) {
        if (files.every((f) => f.status === "cancelled")) return "cancelled";
        if (files.some((f) => f.status === "error")) return "failed";
        return "done";
      }
      return "queued";
    }

    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Uploading…</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={ctx.togglePause}
              className="gap-2"
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              )}
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {completedFiles} / {totalFiles} files
                {speedBps > 0 && <span className="ml-2">{humanSpeed(speedBps)}</span>}
              </span>
              {etaSeconds !== null && (
                <span>
                  ~{etaSeconds < 60
                    ? `${etaSeconds}s`
                    : `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`}{" "}
                  remaining
                </span>
              )}
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          <div className="space-y-3">
            {resolvedGroups.map((group) => {
              const groupFiles = queueFiles.filter((f) => f.groupId === group.id);
              const groupDone = groupFiles.filter((f) => f.status === "done").length;
              const groupFailed = groupFiles.filter((f) => f.status === "error").length;
              const groupTotal = groupFiles.filter((f) => f.status !== "skipped").length;
              const status = getGroupStatus(group.id);
              const isExpanded = expandedGroups.has(group.id);

              const folderIds = [...new Set(groupFiles.map((f) => f.folderId))];

              return (
                <div
                  key={group.id}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                >
                  <div className="px-4 py-3 flex items-center gap-3">
                    <button
                      onClick={() => toggleGroupExpand(group.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {status === "queued" && "Queued"}
                        {status === "uploading" &&
                          `Uploading ${groupDone + 1} / ${groupTotal}`}
                        {status === "done" &&
                          `${groupDone} uploaded${groupFailed > 0 ? `, ${groupFailed} failed` : ""}`}
                        {status === "failed" && `${groupDone} done, ${groupFailed} failed`}
                        {status === "cancelled" && "Cancelled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(status === "queued" || status === "uploading") && (
                        <button
                          onClick={() => ctx.cancelGroup(group.id)}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          title="Cancel this group"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {status === "uploading" && (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      )}
                      {status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {status === "failed" && (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      {status === "cancelled" && (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && folderIds.length > 0 && (
                    <div className="border-t border-border divide-y divide-border">
                      {folderIds.map((folderId) => {
                        const folderFiles = groupFiles.filter((f) => f.folderId === folderId);
                        const folderName =
                          folderFiles[0]?.folderName ?? folderId;
                        const folderDone = folderFiles.filter((f) => f.status === "done").length;
                        const folderFailed = folderFiles.filter((f) => f.status === "error").length;
                        const folderTotal = folderFiles.filter((f) => f.status !== "skipped").length;
                        const folderUploading = folderFiles.filter((f) => f.status === "uploading").length;

                        return (
                          <div key={folderId} className="px-8 py-2.5 flex items-center gap-3">
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground truncate">{folderName}</p>
                              <p className="text-xs text-muted-foreground">
                                {folderUploading > 0
                                  ? `Uploading ${folderDone + 1} / ${folderTotal}`
                                  : `${folderDone} / ${folderTotal}`}
                                {folderFailed > 0 && ` · ${folderFailed} failed`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (localPhase === "duplicate-check") {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocalPhase("staging")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Duplicate Files Detected</h1>
              <p className="text-sm text-muted-foreground">
                {duplicates.length} file{duplicates.length !== 1 ? "s" : ""} already exist in the
                target album.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">File</span>
              <div className="flex items-center gap-4">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setDuplicates((prev) => prev.map((d) => ({ ...d, skip: true })))}
                >
                  Skip all
                </button>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setDuplicates((prev) => prev.map((d) => ({ ...d, skip: false })))
                  }
                >
                  Overwrite all
                </button>
              </div>
            </div>
            {duplicates.map((dup, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <Checkbox
                  checked={dup.skip}
                  onCheckedChange={(checked) =>
                    setDuplicates((prev) =>
                      prev.map((d, j) => (j === i ? { ...d, skip: !!checked } : d))
                    )
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{dup.name}</p>
                  <p className="text-xs text-muted-foreground">{humanSize(dup.size)}</p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    dup.skip
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-100 text-amber-700"
                  )}
                >
                  {dup.skip ? "Skip" : "Overwrite"}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLocalPhase("staging")}>
              Cancel
            </Button>
            <Button onClick={() => doStartQueue(duplicates)}>Continue Upload</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/albums")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Albums
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Bulk Upload</h1>
            <p className="text-sm text-muted-foreground">
              Drop multiple event folders at once, group them, and upload to albums in one batch.
            </p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("upload")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
              activeTab === "upload"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2",
              activeTab === "history"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
          <>
          <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-xl py-12 flex flex-col items-center justify-center gap-3 transition-colors cursor-default",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/40"
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
                <p className="text-xs text-muted-foreground mt-1">
                  Drag and drop entire event folders — multiple at once
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => folderInputRef.current?.click()}
              >
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
                onChange={handleFolderInput}
              />
            </>
          )}
        </div>

        {folders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Groups ({groups.length})</h2>
              <p className="text-xs text-muted-foreground">
                {folders.reduce((sum, f) => sum + f.files.length, 0)} photos total
              </p>
            </div>

            <div className="space-y-3">
              {groups.map((group) => {
                const groupFolders = folders.filter((f) => group.folderIds.includes(f.id));
                const totalGroupFiles = groupFolders.reduce((s, f) => s + f.files.length, 0);
                const isExpanded = expandedGroups.has(group.id);
                const otherGroups = groups.filter((g) => g.id !== group.id);

                return (
                  <div
                    key={group.id}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <div
                      className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleGroupExpand(group.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {groupFolders.length} folder{groupFolders.length !== 1 ? "s" : ""} ·{" "}
                          {totalGroupFiles} photos
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGroup(group.id);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Ungroup all folders"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                        {groupFolders.map((folder) => (
                          <div key={folder.id} className="flex items-center gap-3">
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-xs text-foreground truncate">
                              {folder.name}
                              <span className="text-muted-foreground ml-1.5">
                                ({folder.files.length} photos)
                              </span>
                            </span>
                            {otherGroups.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                                    Move to group
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  {otherGroups.map((g) => {
                                    const gName =
                                      g.newAlbumName ||
                                      deriveGroupName(
                                        folders.filter((f) => g.folderIds.includes(f.id))
                                      );
                                    return (
                                      <DropdownMenuItem
                                        key={g.id}
                                        onSelect={() => mergeFolderIntoGroup(folder.id, g.id)}
                                      >
                                        {gName}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {groupFolders.length > 1 && (
                              <button
                                onClick={() => removeFolder(folder.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove from group"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-border px-4 py-3 space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Album destination
                      </label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={group.destType}
                          onValueChange={(v) =>
                            updateGroup(group.id, {
                              destType: v as "new" | "existing",
                              existingAlbumId: undefined,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Create new album</SelectItem>
                            <SelectItem value="existing">Use existing album</SelectItem>
                          </SelectContent>
                        </Select>

                        {group.destType === "new" ? (
                          <Input
                            value={group.newAlbumName}
                            onChange={(e) =>
                              updateGroup(group.id, { newAlbumName: e.target.value })
                            }
                            placeholder="Album name"
                            className="h-8 text-xs flex-1"
                          />
                        ) : (
                          <div className="flex-1 space-y-1">
                            <Input
                              value={albumSearch}
                              onChange={(e) => setAlbumSearch(e.target.value)}
                              placeholder="Search albums…"
                              className="h-8 text-xs"
                            />
                            {filteredAlbums && filteredAlbums.length > 0 && (
                              <div className="rounded-md border border-border bg-popover max-h-32 overflow-y-auto divide-y divide-border">
                                {filteredAlbums.map((album) => (
                                  <button
                                    key={album.id}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors",
                                      group.existingAlbumId === album.id && "bg-primary/10 text-primary font-medium"
                                    )}
                                    onClick={() =>
                                      updateGroup(group.id, { existingAlbumId: album.id })
                                    }
                                  >
                                    {album.title}
                                  </button>
                                ))}
                              </div>
                            )}
                            {group.existingAlbumId && (
                              <p className="text-xs text-primary font-medium">
                                ✓{" "}
                                {albums?.find((a) => a.id === group.existingAlbumId)?.title}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleStartUpload}
                disabled={!canStartUpload}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Start Upload ({folders.reduce((sum, f) => sum + f.files.length, 0)} photos)
              </Button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAbsoluteDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Album {
  id: number;
  title: string;
}

interface BatchRecord {
  id: number;
  groupNames: string[];
  albumIds: number[];
  totalUploaded: number;
  failedCount: number;
  createdAt: Date | string;
}

function HistoryTab({
  batches,
  isLoading,
  albums,
}: {
  batches: BatchRecord[];
  isLoading: boolean;
  albums: Album[];
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading history…</span>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <Clock className="h-10 w-10 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">No upload history yet</p>
          <p className="text-xs mt-1 opacity-70">Completed batches will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const albumMap = new Map(albums.map((a) => [a.id, a.title]));
        const hasFailures = batch.failedCount > 0;

        return (
          <div
            key={batch.id}
            className="rounded-xl border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {batch.groupNames.map((name, i) => (
                    <span
                      key={i}
                      className="text-sm font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {batch.totalUploaded} photo{batch.totalUploaded !== 1 ? "s" : ""} uploaded
                  {hasFailures && (
                    <span className="text-amber-600 ml-1">· {batch.failedCount} failed</span>
                  )}
                </p>
              </div>
              <div
                className="text-xs text-muted-foreground shrink-0"
                title={formatAbsoluteDate(batch.createdAt)}
              >
                {formatRelativeTime(batch.createdAt)}
              </div>
            </div>

            {batch.albumIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {batch.albumIds.map((albumId) => {
                  const title = albumMap.get(albumId) ?? `Album #${albumId}`;
                  return (
                    <Link
                      key={albumId}
                      href={`/albums/${albumId}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline bg-primary/8 px-2.5 py-1 rounded-full"
                    >
                      <LinkIcon className="h-3 w-3" />
                      {title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
