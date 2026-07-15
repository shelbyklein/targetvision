import sharp from "sharp";
import { and, eq, isNull, isNotNull, inArray, sql, desc } from "drizzle-orm";
import { db, photosTable, albumsTable, photoCollectionsTable } from "@workspace/db";
import { objectStorageClient, parseObjectPath, getPrivateObjectDir } from "./objectStorage";
import { logger } from "./logger";
import { createLimiter } from "./concurrencyLimit";

// Bound concurrent hashings: each downloads + downscales the full-size source
// image. Fired off per-upload without awaiting (mirrors content-hash /
// thumbnail generation), so cap peak memory regardless of upload rate.
const perceptualHashLimiter = createLimiter(2);

function resolveSourceFile(storageKey: string) {
  const privateObjectDir = getPrivateObjectDir();
  const entityDirBase = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;
  const entityId = storageKey.slice("/objects/".length);
  const objectEntityPath = `${entityDirBase}${entityId}`;
  const { bucketName, objectName } = parseObjectPath(objectEntityPath);
  return objectStorageClient.bucket(bucketName).file(objectName);
}

export type PerceptualHashResult = "success" | "skipped" | "failed";

/**
 * Compute a 64-bit dHash (difference hash) for the image and return it as 16 hex
 * chars. The image is reduced to 9x8 grayscale; each of the 8 rows contributes 8
 * bits from comparing horizontally-adjacent pixels (9 pixels -> 8 comparisons).
 * dHash is robust to re-encoding, resizing and mild compression, which is what
 * makes it catch near-duplicates that a byte-hash misses.
 */
export async function computeDHash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // After grayscale all channels are equal, so read channel 0 regardless of how
  // many channels sharp emitted for this format.
  const ch = info.channels;
  const lum = (row: number, col: number) => data[(row * 9 + col) * ch];

  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      bits += lum(row, col) < lum(row, col + 1) ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance (number of differing bits) between two 16-char hex dHashes. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

/**
 * Download a photo's original bytes, compute its dHash and store it on the row.
 * Used both on upload (fire-and-forget) and by the backfill.
 */
export function computeAndStorePerceptualHash(photoId: number, storageKey: string): Promise<PerceptualHashResult> {
  return perceptualHashLimiter(() => computeAndStorePerceptualHashUnbounded(photoId, storageKey));
}

async function computeAndStorePerceptualHashUnbounded(photoId: number, storageKey: string): Promise<PerceptualHashResult> {
  if (!storageKey.startsWith("/objects/")) {
    logger.warn({ photoId, storageKey }, "Cannot compute perceptual hash: unexpected storageKey format");
    return "skipped";
  }

  try {
    const sourceFile = resolveSourceFile(storageKey);
    const [exists] = await sourceFile.exists();
    if (!exists) {
      logger.warn({ photoId, storageKey }, "Source file not found, skipping perceptual hash");
      return "skipped";
    }

    const [sourceBuffer] = await sourceFile.download();
    const hash = await computeDHash(sourceBuffer as Buffer);

    await db.update(photosTable).set({ perceptualHash: hash }).where(eq(photosTable.id, photoId));
    logger.info({ photoId }, "Perceptual hash computed and stored");
    return "success";
  } catch (err) {
    logger.error({ err, photoId, storageKey }, "Perceptual hash computation failed");
    return "failed";
  }
}

export async function countPhotosWithoutPerceptualHash(): Promise<number> {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(and(isNull(photosTable.perceptualHash), isNotNull(photosTable.storageKey)));
  return rows.length;
}

export async function backfillPerceptualHashes(limit?: number): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const base = db
    .select({ id: photosTable.id, storageKey: photosTable.storageKey })
    .from(photosTable)
    .where(and(isNull(photosTable.perceptualHash), isNotNull(photosTable.storageKey)))
    .orderBy(photosTable.createdAt);
  const photos = limit && limit > 0 ? await base.limit(limit) : await base;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    if (!photo.storageKey) {
      skipped++;
      continue;
    }
    const result = await computeAndStorePerceptualHash(photo.id, photo.storageKey);
    if (result === "success") {
      updated++;
    } else if (result === "skipped") {
      skipped++;
    } else {
      failed++;
    }
  }

  return { processed: photos.length, updated, skipped, failed };
}

export interface NearDuplicatePhoto {
  id: number;
  albumId: number;
  albumTitle: string | null;
  filename: string | null;
  url: string;
  thumbnailKey: string | null;
  createdAt: Date;
  isAlbumCover: boolean;
  collectionCount: number;
}

export interface NearDuplicateGroup {
  key: string;
  distance: number;
  photos: NearDuplicatePhoto[];
}

export const DEFAULT_NEAR_DUP_THRESHOLD = 6;
// Cap the threshold: past ~10 bits (of 64) the transitive union-find chains
// merely-similar photos into a useless mega-cluster, so "near-duplicate"
// detection stays conservative on purpose.
export const MAX_NEAR_DUP_THRESHOLD = 10;

/**
 * Find groups of photos whose dHashes are within `threshold` bits of each other
 * (near-duplicates: re-encoded/resized copies as well as byte-identical ones).
 * Photos are connected transitively via union-find; only components with 2+
 * members are returned. Each photo is annotated with album-cover / collection
 * membership so the UI can warn before deleting a referenced photo.
 */
export async function listNearDuplicatePhotoGroups(
  threshold: number = DEFAULT_NEAR_DUP_THRESHOLD,
): Promise<NearDuplicateGroup[]> {
  const rows = await db
    .select({
      id: photosTable.id,
      perceptualHash: photosTable.perceptualHash,
      albumId: photosTable.albumId,
      albumTitle: albumsTable.title,
      coverPhotoId: albumsTable.coverPhotoId,
      filename: photosTable.filename,
      url: photosTable.url,
      thumbnailKey: photosTable.thumbnailKey,
      createdAt: photosTable.createdAt,
    })
    .from(photosTable)
    .leftJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
    .where(isNotNull(photosTable.perceptualHash))
    .orderBy(desc(photosTable.createdAt));

  const n = rows.length;
  if (n < 2) return [];

  // Union-find over photos connected by dHash Hamming distance <= threshold.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  // Track the largest pairwise distance that joined each component, for display.
  const hashes = rows.map((r) => r.perceptualHash as string);
  const pairMaxDistance = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = hammingDistance(hashes[i], hashes[j]);
      if (d <= threshold) {
        union(i, j);
        const root = find(i);
        pairMaxDistance.set(root, Math.max(pairMaxDistance.get(root) ?? 0, d));
      }
    }
  }

  // Bucket photo indices by component root.
  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = components.get(root) ?? [];
    list.push(i);
    components.set(root, list);
  }

  const groupRoots = [...components.entries()].filter(([, idx]) => idx.length > 1);
  if (groupRoots.length === 0) return [];

  // Collection counts for only the photos that appear in a near-dup group.
  const groupedIds = groupRoots.flatMap(([, idx]) => idx.map((i) => rows[i].id));
  const collectionCounts = new Map<number, number>();
  if (groupedIds.length > 0) {
    const countRows = await db
      .select({ photoId: photoCollectionsTable.photoId, cnt: sql<number>`count(*)::int` })
      .from(photoCollectionsTable)
      .where(inArray(photoCollectionsTable.photoId, groupedIds))
      .groupBy(photoCollectionsTable.photoId);
    for (const c of countRows) collectionCounts.set(c.photoId, c.cnt);
  }

  const groups: NearDuplicateGroup[] = groupRoots.map(([root, idx]) => ({
    // Newest-first within a group (rows are already sorted that way).
    key: hashes[idx[0]],
    distance: pairMaxDistance.get(find(root)) ?? 0,
    photos: idx.map((i) => {
      const r = rows[i];
      return {
        id: r.id,
        albumId: r.albumId,
        albumTitle: r.albumTitle ?? null,
        filename: r.filename ?? null,
        url: r.url,
        thumbnailKey: r.thumbnailKey ?? null,
        createdAt: r.createdAt,
        isAlbumCover: r.coverPhotoId === r.id,
        collectionCount: collectionCounts.get(r.id) ?? 0,
      };
    }),
  }));

  // Largest / most-similar groups first.
  groups.sort((a, b) => b.photos.length - a.photos.length || a.distance - b.distance);
  return groups;
}
