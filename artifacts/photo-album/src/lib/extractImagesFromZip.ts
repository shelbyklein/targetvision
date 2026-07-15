import { Unzip, UnzipInflate, type UnzipFile } from "fflate";
import type { FolderEntry } from "@/components/bulk-upload/types";

// Keep in sync with bulk-upload.tsx's MAX_FILE_SIZE (per-image cap).
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Extensions we accept, mapped to the image MIME the upload pipeline requires
// (uploadFile drops any File whose type doesn't start with "image/").
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
};

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function extOf(path: string): string {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

// Archive cruft that shouldn't become photos: macOS resource forks, thumbnail
// databases, and dotfiles (incl. AppleDouble "._name" siblings).
function isJunk(path: string): boolean {
  const base = basename(path);
  return (
    path.startsWith("__MACOSX/") ||
    path.includes("/__MACOSX/") ||
    base === ".DS_Store" ||
    base === "Thumbs.db" ||
    base.startsWith(".")
  );
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Extract the image files from a .zip into the FolderEntry[] shape the bulk
 * upload staging UI already consumes. Non-images, archive junk, directory
 * entries, and oversized files are skipped. Files are grouped by their
 * top-level folder (matching the folder picker's grouping); loose images at the
 * archive root fall into "(root)".
 *
 * Uses fflate's streaming Unzip fed from the File's ReadableStream, so the whole
 * archive is never held in one buffer and images are materialized one at a time
 * — this handles multi-GB folder-tree archives that a single `arrayBuffer()` +
 * flat unzip can't allocate.
 */
export async function extractImagesFromZip(zip: File): Promise<FolderEntry[]> {
  const byFolder = new Map<string, File[]>();

  await new Promise<void>((resolve, reject) => {
    let streamDone = false;
    let pending = 0; // image entries still decompressing
    const settle = () => {
      if (streamDone && pending === 0) resolve();
    };

    const unzipper = new Unzip((file: UnzipFile) => {
      const name = file.name;
      const mime = EXT_MIME[extOf(name)];
      // Skip directory entries, junk, and non-images by simply not starting the
      // stream — fflate advances past unstarted entries.
      if (name.endsWith("/") || isJunk(name) || !mime) return;

      pending++;
      const chunks: Uint8Array[] = [];
      let size = 0;
      let dropped = false;

      file.ondata = (err, chunk, final) => {
        if (dropped) return;
        if (err) {
          dropped = true;
          pending--;
          reject(err);
          return;
        }
        if (chunk && chunk.length) {
          size += chunk.length;
          if (size > MAX_FILE_SIZE) {
            // Too large — abandon this one entry but keep extracting the rest.
            dropped = true;
            chunks.length = 0;
            pending--;
            settle();
            return;
          }
          chunks.push(chunk);
        }
        if (final) {
          const parts = name.split("/");
          const folderName = parts.length > 1 ? parts[0] : "(root)";
          const f = new File(chunks as BlobPart[], basename(name), { type: mime });
          const list = byFolder.get(folderName);
          if (list) list.push(f);
          else byFolder.set(folderName, [f]);
          pending--;
          settle();
        }
      };
      file.start();
    });
    // Enable DEFLATE decompression (stored entries need no decompressor).
    unzipper.register(UnzipInflate);

    const reader = zip.stream().getReader();
    const pump = (): Promise<void> =>
      reader.read().then(({ done, value }) => {
        if (done) {
          unzipper.push(new Uint8Array(0), true);
          streamDone = true;
          settle();
          return;
        }
        unzipper.push(value, false);
        return pump();
      });
    pump().catch(reject);
  });

  const folders: FolderEntry[] = [];
  for (const [name, files] of byFolder.entries()) {
    if (files.length > 0) folders.push({ id: genId(), name, files });
  }
  return folders;
}
