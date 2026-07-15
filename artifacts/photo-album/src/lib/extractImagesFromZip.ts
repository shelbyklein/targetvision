import { unzip, type Unzipped, type UnzipFileInfo } from "fflate";
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

function unzipAsync(data: Uint8Array, filter: (f: UnzipFileInfo) => boolean): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, { filter }, (err, unzipped) => (err ? reject(err) : resolve(unzipped)));
  });
}

/**
 * Extract the image files from a .zip into the FolderEntry[] shape the bulk
 * upload staging UI already consumes. Non-images, archive junk, directory
 * entries, and oversized files are skipped. Files are grouped by their
 * top-level folder (matching the folder picker's grouping); loose images at the
 * archive root fall into "(root)". Runs decompression off the main thread.
 */
export async function extractImagesFromZip(zip: File): Promise<FolderEntry[]> {
  const buf = new Uint8Array(await zip.arrayBuffer());

  const unzipped = await unzipAsync(buf, (f) => {
    if (f.name.endsWith("/")) return false; // directory entry
    if (isJunk(f.name)) return false;
    if (!EXT_MIME[extOf(f.name)]) return false; // not a known image type
    if (f.originalSize > MAX_FILE_SIZE) return false;
    return true;
  });

  const byFolder = new Map<string, File[]>();
  for (const [path, bytes] of Object.entries(unzipped)) {
    const mime = EXT_MIME[extOf(path)];
    if (!mime) continue;
    const parts = path.split("/");
    const folderName = parts.length > 1 ? parts[0] : "(root)";
    const file = new File([bytes], basename(path), { type: mime });
    const list = byFolder.get(folderName);
    if (list) list.push(file);
    else byFolder.set(folderName, [file]);
  }

  const folders: FolderEntry[] = [];
  for (const [name, files] of byFolder.entries()) {
    if (files.length > 0) folders.push({ id: genId(), name, files });
  }
  return folders;
}
