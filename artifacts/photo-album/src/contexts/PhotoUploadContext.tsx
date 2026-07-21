import { createContext, useContext, useState, useRef, useCallback } from "react";
import { uploadPhoto } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";

// Lightweight sibling to BulkUploadContext for the album "Upload Photos"
// dialog: the dialog stages files, then hands them here to run. Because this
// provider lives above the router, the upload keeps going — and stays visible
// in a banner — after the dialog closes or the user navigates away.

const CONCURRENCY = 4;

export type PhotoUploadPhase = "idle" | "uploading" | "complete";
type ItemStatus = "pending" | "uploading" | "done" | "error" | "cancelled";

interface UploadItem {
  id: string;
  name: string;
  status: ItemStatus;
}

interface PhotoUploadContextValue {
  phase: PhotoUploadPhase;
  albumId: number | null;
  albumTitle: string | null;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  overallProgress: number;
  start: (albumId: number, albumTitle: string, files: File[], onProgress?: () => void) => void;
  cancel: () => void;
  dismiss: () => void;
}

const PhotoUploadContext = createContext<PhotoUploadContextValue | null>(null);

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function PhotoUploadProvider({ children }: { children: React.ReactNode }) {
  const { uploadFile } = useUpload({ basePath: "/api/storage" });
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  const [phase, setPhase] = useState<PhotoUploadPhase>("idle");
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [albumTitle, setAlbumTitle] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  // Byte-weighted progress: per-file uploaded fractions (from XHR progress
  // events) live in a ref and flush to state on a ~150ms trailing throttle, so
  // large files move the banner's bar smoothly without re-rendering per event.
  // Deliberately setTimeout, not requestAnimationFrame: rAF never fires in a
  // hidden tab, and a background upload is exactly where the user isn't looking.
  const [byteProgress, setByteProgress] = useState(0);
  const fractionsRef = useRef(new Map<string, number>());
  const sizesRef = useRef(new Map<string, number>());
  const totalBytesRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushByteProgress = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const totalBytes = totalBytesRef.current;
      if (totalBytes <= 0) return;
      let uploaded = 0;
      for (const [id, fraction] of fractionsRef.current) {
        uploaded += (sizesRef.current.get(id) ?? 0) * fraction;
      }
      setByteProgress(Math.min(100, Math.round((uploaded / totalBytes) * 100)));
    }, 150);
  }, []);

  const total = items.length;
  const succeeded = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;
  const cancelled = items.filter((i) => i.status === "cancelled").length;
  const completed = succeeded + failed + cancelled;
  const countProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overallProgress = totalBytesRef.current > 0 ? byteProgress : countProgress;

  const start = useCallback(
    (targetAlbumId: number, targetAlbumTitle: string, files: File[], onProgress?: () => void) => {
      if (runningRef.current || files.length === 0) return;
      runningRef.current = true;

      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;

      const queue = files.map((file) => ({ id: genId(), file }));
      fractionsRef.current = new Map(queue.map(({ id }) => [id, 0]));
      sizesRef.current = new Map(queue.map(({ id, file }) => [id, file.size]));
      totalBytesRef.current = files.reduce((sum, f) => sum + f.size, 0);
      setByteProgress(0);
      setAlbumId(targetAlbumId);
      setAlbumTitle(targetAlbumTitle);
      setItems(queue.map(({ id, file }) => ({ id, name: file.name, status: "pending" as ItemStatus })));
      setPhase("uploading");

      let cursor = 0;
      const setStatus = (id: string, status: ItemStatus) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));

      async function runNext(): Promise<void> {
        if (cursor >= queue.length) return;
        const { id, file } = queue[cursor++];

        if (signal.aborted) {
          setStatus(id, "cancelled");
          fractionsRef.current.set(id, 1);
          flushByteProgress();
          await runNext();
          return;
        }
        setStatus(id, "uploading");
        try {
          const result = await uploadFileRef.current(
            file,
            (percent) => {
              fractionsRef.current.set(id, percent / 100);
              flushByteProgress();
            },
            signal,
          );
          if (!result) throw new Error("Upload failed");
          await uploadPhoto(targetAlbumId, {
            url: `/api/storage${result.objectPath}`,
            storageKey: result.objectPath,
            contentType: file.type,
            filename: file.name,
            filesize: file.size,
          });
          setStatus(id, "done");
          onProgress?.();
        } catch (err) {
          const isAbort =
            signal.aborted ||
            (err instanceof Error && (err.name === "AbortError" || err.message === "Upload aborted"));
          setStatus(id, isAbort ? "cancelled" : "error");
        } finally {
          // Settle the file's byte share whatever the outcome, so the bar
          // reaches 100% when the run finishes (errors/cancels included).
          fractionsRef.current.set(id, 1);
          flushByteProgress();
        }
        await runNext();
      }

      void Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, runNext),
      ).then(() => {
        runningRef.current = false;
        controllerRef.current = null;
        setPhase("complete");
      });
    },
    [flushByteProgress],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const dismiss = useCallback(() => {
    if (runningRef.current) return;
    setPhase("idle");
    setItems([]);
    setAlbumId(null);
    setAlbumTitle(null);
    fractionsRef.current = new Map();
    sizesRef.current = new Map();
    totalBytesRef.current = 0;
    setByteProgress(0);
  }, []);

  return (
    <PhotoUploadContext.Provider
      value={{
        phase,
        albumId,
        albumTitle,
        total,
        completed,
        succeeded,
        failed,
        overallProgress,
        start,
        cancel,
        dismiss,
      }}
    >
      {children}
    </PhotoUploadContext.Provider>
  );
}

export function usePhotoUpload(): PhotoUploadContextValue {
  const ctx = useContext(PhotoUploadContext);
  if (!ctx) throw new Error("usePhotoUpload must be used inside PhotoUploadProvider");
  return ctx;
}

export function usePhotoUploadOptional(): PhotoUploadContextValue | null {
  return useContext(PhotoUploadContext);
}
