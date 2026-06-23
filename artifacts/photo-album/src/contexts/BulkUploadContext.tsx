import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { uploadPhoto, createAlbum, createBulkUploadBatch } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";

const CONCURRENCY = 4;
const SESSION_KEY = "bulk_upload_queue_v2";

export type FileStatus = "pending" | "skipped" | "uploading" | "done" | "error" | "cancelled";
export type BulkPhase = "idle" | "uploading" | "complete";

export interface QueueFile {
  id: string;
  filename: string;
  filesize: number;
  folderName: string;
  folderId: string;
  groupId: string;
  status: FileStatus;
  progress: number;
  errorMessage?: string;
}

export interface ResolvedGroup {
  id: string;
  name: string;
  albumId: number;
  folderIds: string[];
}

export interface GroupSpec {
  id: string;
  name: string;
  destType: "new" | "existing";
  existingAlbumId?: number;
  folderIds: string[];
}

interface SessionQueueState {
  phase: BulkPhase;
  resolvedGroups: ResolvedGroup[];
  queueFiles: QueueFile[];
  savedAt: number;
}

interface BulkUploadContextValue {
  phase: BulkPhase;
  queueFiles: QueueFile[];
  resolvedGroups: ResolvedGroup[];
  isPaused: boolean;
  speedBps: number;
  etaSeconds: number | null;
  totalFiles: number;
  completedFiles: number;
  overallProgress: number;
  canRetry: boolean;
  orphanedCount: number;
  startQueue: (
    groups: GroupSpec[],
    folderFiles: Map<string, File[]>,
    folderNames: Map<string, string>,
    skipFileKeys: Set<string>
  ) => Promise<{ success: boolean; error?: string }>;
  cancelGroup: (groupId: string) => void;
  togglePause: () => void;
  retryFailed: (groupId?: string) => void;
  reattachAndRetry: (files: File[]) => number;
  resetQueue: () => void;
}

const BulkUploadContext = createContext<BulkUploadContextValue | null>(null);

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function saveSession(state: SessionQueueState) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {}
}

function loadSession(): SessionQueueState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionQueueState;
    if (!parsed.phase || !parsed.queueFiles || !parsed.resolvedGroups) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function BulkUploadProvider({ children }: { children: React.ReactNode }) {
  const { uploadFile } = useUpload({ basePath: "/api/storage" });

  const [phase, setPhase] = useState<BulkPhase>("idle");
  const [queueFiles, setQueueFiles] = useState<QueueFile[]>([]);
  const [resolvedGroups, setResolvedGroups] = useState<ResolvedGroup[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speedBps, setSpeedBps] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [orphanedCount, setOrphanedCount] = useState(0);

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef<Set<string>>(new Set());
  const fileStoreRef = useRef<Map<string, File>>(new Map());
  const totalBytesRef = useRef(0);
  const bytesUploadedRef = useRef(0);
  const speedWindowRef = useRef<Array<{ time: number; bytes: number }>>([]);
  const isRunningRef = useRef(false);
  const uploadFileRef = useRef(uploadFile);
  const resolvedGroupsRef = useRef<ResolvedGroup[]>([]);

  useEffect(() => { uploadFileRef.current = uploadFile; }, [uploadFile]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { resolvedGroupsRef.current = resolvedGroups; }, [resolvedGroups]);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    const now = Date.now();
    if (now - session.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const restored = session.queueFiles.map((f) =>
      f.status === "uploading" || f.status === "pending"
        ? { ...f, status: "error" as FileStatus, errorMessage: "Interrupted (tab closed or refreshed)" }
        : f
    );
    const interruptedCount = restored.filter((f) => f.status === "error").length;
    setOrphanedCount(interruptedCount);
    setQueueFiles(restored);
    setResolvedGroups(session.resolvedGroups);
    resolvedGroupsRef.current = session.resolvedGroups;
    setPhase(session.phase === "uploading" ? "complete" : session.phase);
  }, []);

  const totalFiles = queueFiles.filter((f) => f.status !== "skipped").length;
  const completedFiles = queueFiles.filter(
    (f) => f.status === "done" || f.status === "error" || f.status === "cancelled"
  ).length;
  const overallProgress =
    totalFiles > 0 ? Math.min(99, Math.floor((completedFiles / totalFiles) * 100)) : 0;
  const canRetry =
    queueFiles.some((f) => f.status === "error") && fileStoreRef.current.size > 0;

  function updateSpeed(newBytes: number) {
    bytesUploadedRef.current += newBytes;
    const now = Date.now();
    speedWindowRef.current.push({ time: now, bytes: bytesUploadedRef.current });
    const windowMs = 5000;
    speedWindowRef.current = speedWindowRef.current.filter((e) => now - e.time <= windowMs);
    if (speedWindowRef.current.length >= 2) {
      const oldest = speedWindowRef.current[0];
      const newest = speedWindowRef.current[speedWindowRef.current.length - 1];
      const elapsed = (newest.time - oldest.time) / 1000;
      if (elapsed > 0) {
        const speed = (newest.bytes - oldest.bytes) / elapsed;
        setSpeedBps(speed);
        const remaining = totalBytesRef.current - bytesUploadedRef.current;
        setEtaSeconds(speed > 0 ? Math.ceil(remaining / speed) : null);
      }
    }
  }

  async function runQueue(
    pendingFiles: QueueFile[],
    groupAlbumMap: Map<string, number>
  ): Promise<{ successCount: number; failedCount: number }> {
    if (pendingFiles.length === 0) return { successCount: 0, failedCount: 0 };
    let cursor = 0;
    let successCount = 0;
    let failedCount = 0;

    async function runNext(): Promise<void> {
      if (cursor >= pendingFiles.length) return;
      const qFile = pendingFiles[cursor++];

      if (isCancelledRef.current.has(qFile.groupId)) {
        setQueueFiles((prev) =>
          prev.map((f) => (f.id === qFile.id ? { ...f, status: "cancelled" } : f))
        );
        await runNext();
        return;
      }

      while (isPausedRef.current) {
        await new Promise((r) => setTimeout(r, 300));
      }

      setQueueFiles((prev) =>
        prev.map((f) =>
          f.id === qFile.id ? { ...f, status: "uploading", progress: 5 } : f
        )
      );

      const file = fileStoreRef.current.get(qFile.id);
      const albumId = groupAlbumMap.get(qFile.groupId);

      if (!file || albumId === undefined) {
        setQueueFiles((prev) =>
          prev.map((f) =>
            f.id === qFile.id
              ? { ...f, status: "error", progress: 0, errorMessage: "File not available" }
              : f
          )
        );
        failedCount++;
        await runNext();
        return;
      }

      try {
        const result = await uploadFileRef.current(file);

        if (isCancelledRef.current.has(qFile.groupId)) {
          setQueueFiles((prev) =>
            prev.map((f) =>
              f.id === qFile.id ? { ...f, status: "cancelled", progress: 0 } : f
            )
          );
          await runNext();
          return;
        }

        if (!result) throw new Error("Upload failed");

        updateSpeed(file.size);
        setQueueFiles((prev) =>
          prev.map((f) => (f.id === qFile.id ? { ...f, progress: 70 } : f))
        );

        await uploadPhoto(albumId, {
          url: `/api/storage${result.objectPath}`,
          storageKey: result.objectPath,
          contentType: file.type,
          filename: file.name,
          filesize: file.size,
        });

        setQueueFiles((prev) =>
          prev.map((f) =>
            f.id === qFile.id ? { ...f, status: "done", progress: 100 } : f
          )
        );
        successCount++;
      } catch {
        if (!isCancelledRef.current.has(qFile.groupId)) {
          setQueueFiles((prev) =>
            prev.map((f) =>
              f.id === qFile.id
                ? { ...f, status: "error", progress: 0, errorMessage: "Upload failed" }
                : f
            )
          );
          failedCount++;
        }
      }

      await runNext();
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pendingFiles.length) }, runNext)
    );

    return { successCount, failedCount };
  }

  const startQueue = useCallback(
    async (
      groups: GroupSpec[],
      folderFiles: Map<string, File[]>,
      folderNames: Map<string, string>,
      skipFileKeys: Set<string>
    ): Promise<{ success: boolean; error?: string }> => {
      if (isRunningRef.current) return { success: false, error: "Queue already running" };
      isRunningRef.current = true;

      isCancelledRef.current.clear();
      bytesUploadedRef.current = 0;
      speedWindowRef.current = [];
      fileStoreRef.current.clear();
      setIsPaused(false);
      setSpeedBps(0);
      setEtaSeconds(null);

      const groupAlbumMap = new Map<string, number>();
      const resolvedList: ResolvedGroup[] = [];

      for (const g of groups) {
        if (g.destType === "existing" && g.existingAlbumId) {
          groupAlbumMap.set(g.id, g.existingAlbumId);
          resolvedList.push({
            id: g.id,
            name: g.name,
            albumId: g.existingAlbumId,
            folderIds: g.folderIds,
          });
        } else {
          try {
            const created = await createAlbum({ title: g.name.trim() });
            groupAlbumMap.set(g.id, created.id);
            resolvedList.push({
              id: g.id,
              name: g.name,
              albumId: created.id,
              folderIds: g.folderIds,
            });
          } catch {
            isRunningRef.current = false;
            return { success: false, error: `Failed to create album "${g.name}"` };
          }
        }
      }

      setResolvedGroups(resolvedList);
      resolvedGroupsRef.current = resolvedList;

      const initialQueue: QueueFile[] = [];
      let totalBytes = 0;

      for (const g of groups) {
        for (const folderId of g.folderIds) {
          const files = folderFiles.get(folderId) ?? [];
          const folderName = folderNames.get(folderId) ?? folderId;
          for (const file of files) {
            const id = genId();
            const key = `${folderId}::${file.name}::${file.size}`;
            const status: FileStatus = skipFileKeys.has(key) ? "skipped" : "pending";
            fileStoreRef.current.set(id, file);
            if (status === "pending") totalBytes += file.size;
            initialQueue.push({
              id,
              filename: file.name,
              filesize: file.size,
              folderName,
              folderId,
              groupId: g.id,
              status,
              progress: 0,
            });
          }
        }
      }

      totalBytesRef.current = totalBytes;
      setQueueFiles(initialQueue);
      setPhase("uploading");

      saveSession({
        phase: "uploading",
        resolvedGroups: resolvedList,
        queueFiles: initialQueue,
        savedAt: Date.now(),
      });

      const pendingFiles = initialQueue.filter((f) => f.status === "pending");
      const { successCount, failedCount } = await runQueue(pendingFiles, groupAlbumMap);

      setPhase("complete");
      isRunningRef.current = false;

      void createBulkUploadBatch({
        groupNames: resolvedList.map((g) => g.name),
        albumIds: resolvedList.map((g) => g.albumId),
        totalUploaded: successCount,
        failedCount,
      }).catch(() => {});

      return { success: true };
    },
    []
  );

  const cancelGroup = useCallback((groupId: string) => {
    isCancelledRef.current.add(groupId);
    setQueueFiles((prev) =>
      prev.map((f) =>
        f.groupId === groupId && (f.status === "pending" || f.status === "uploading")
          ? { ...f, status: "cancelled" }
          : f
      )
    );
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const retryFailed = useCallback((groupId?: string) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const groupAlbumMap = new Map<string, number>(
      resolvedGroupsRef.current.map((g) => [g.id, g.albumId])
    );

    setQueueFiles((prev) => {
      const toRetry = prev.filter(
        (f) =>
          f.status === "error" &&
          (groupId === undefined || f.groupId === groupId) &&
          fileStoreRef.current.has(f.id)
      );

      if (toRetry.length === 0) {
        isRunningRef.current = false;
        return prev;
      }

      const retryIds = new Set(toRetry.map((f) => f.id));
      const requeued = prev.map((f) =>
        retryIds.has(f.id)
          ? { ...f, status: "pending" as FileStatus, progress: 0, errorMessage: undefined }
          : f
      );

      bytesUploadedRef.current = 0;
      speedWindowRef.current = [];
      totalBytesRef.current = toRetry.reduce(
        (s, f) => s + (fileStoreRef.current.get(f.id)?.size ?? 0),
        0
      );

      setPhase("uploading");
      setSpeedBps(0);
      setEtaSeconds(null);

      const pendingToRetry = requeued.filter((f) => retryIds.has(f.id));
      runQueue(pendingToRetry, groupAlbumMap).then(() => {
        setPhase("complete");
        isRunningRef.current = false;
      });

      return requeued;
    });
  }, []);

  const reattachAndRetry = useCallback((files: File[]): number => {
    const errorFiles = queueFiles.filter(
      (f) => f.status === "error" && !fileStoreRef.current.has(f.id)
    );
    let matchedCount = 0;
    for (const qf of errorFiles) {
      const match = files.find(
        (f) => f.name === qf.filename && f.size === qf.filesize
      );
      if (match) {
        fileStoreRef.current.set(qf.id, match);
        matchedCount++;
      }
    }
    if (matchedCount > 0) {
      setOrphanedCount((prev) => Math.max(0, prev - matchedCount));
      const groupAlbumMap = new Map<string, number>(
        resolvedGroupsRef.current.map((g) => [g.id, g.albumId])
      );
      if (isRunningRef.current) return matchedCount;
      isRunningRef.current = true;
      bytesUploadedRef.current = 0;
      speedWindowRef.current = [];
      totalBytesRef.current = errorFiles
        .filter((f) => fileStoreRef.current.has(f.id))
        .reduce((s, f) => s + f.filesize, 0);
      setPhase("uploading");
      setSpeedBps(0);
      setEtaSeconds(null);
      setQueueFiles((prev) => {
        const toRetry = prev.filter(
          (f) => f.status === "error" && fileStoreRef.current.has(f.id)
        );
        const retryIds = new Set(toRetry.map((f) => f.id));
        const requeued = prev.map((f) =>
          retryIds.has(f.id)
            ? { ...f, status: "pending" as FileStatus, progress: 0, errorMessage: undefined }
            : f
        );
        const pendingToRetry = requeued.filter((f) => retryIds.has(f.id));
        runQueue(pendingToRetry, groupAlbumMap).then(() => {
          setPhase("complete");
          isRunningRef.current = false;
        });
        return requeued;
      });
    }
    return matchedCount;
  }, [queueFiles]);

  const resetQueue = useCallback(() => {
    isRunningRef.current = false;
    isCancelledRef.current.clear();
    fileStoreRef.current.clear();
    speedWindowRef.current = [];
    bytesUploadedRef.current = 0;
    totalBytesRef.current = 0;
    setPhase("idle");
    setQueueFiles([]);
    setResolvedGroups([]);
    resolvedGroupsRef.current = [];
    setIsPaused(false);
    setSpeedBps(0);
    setEtaSeconds(null);
    setOrphanedCount(0);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    if (phase === "idle" || queueFiles.length === 0) return;
    saveSession({ phase, resolvedGroups, queueFiles, savedAt: Date.now() });
  }, [phase, queueFiles, resolvedGroups]);

  return (
    <BulkUploadContext.Provider
      value={{
        phase,
        queueFiles,
        resolvedGroups,
        isPaused,
        speedBps,
        etaSeconds,
        totalFiles,
        completedFiles,
        overallProgress,
        canRetry,
        orphanedCount,
        startQueue,
        cancelGroup,
        togglePause,
        retryFailed,
        reattachAndRetry,
        resetQueue,
      }}
    >
      {children}
    </BulkUploadContext.Provider>
  );
}

export function useBulkUpload(): BulkUploadContextValue {
  const ctx = useContext(BulkUploadContext);
  if (!ctx) throw new Error("useBulkUpload must be used inside BulkUploadProvider");
  return ctx;
}

export function useBulkUploadOptional(): BulkUploadContextValue | null {
  return useContext(BulkUploadContext);
}
