import { createHash } from "crypto";
import { and, eq, isNull, isNotNull, inArray, sql, desc } from "drizzle-orm";
import { db, photosTable, albumsTable, photoCollectionsTable } from "@workspace/db";
import { objectStorageClient, parseObjectPath, getPrivateObjectDir } from "./objectStorage";
import { logger } from "./logger";
import { createLimiter } from "./concurrencyLimit";

// Bound concurrent hashings: each downloads the full-size source image. Fired
// off per-upload without awaiting (mirrors thumbnail generation), so cap peak
// memory regardless of upload rate.
const contentHashLimiter = createLimiter(2);

function resolveSourceFile(storageKey: string) {
  const privateObjectDir = getPrivateObjectDir();
  const entityDirBase = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;
  const entityId = storageKey.slice("/objects/".length);
  const objectEntityPath = `${entityDirBase}${entityId}`;
  const { bucketName, objectName } = parseObjectPath(objectEntityPath);
  return objectStorageClient.bucket(bucketName).file(objectName);
}

export type ContentHashResult = "success" | "skipped" | "failed";

/**
 * Download a photo's original bytes and store their SHA-256 hex digest on the
 * row. Used both on upload (fire-and-forget) and by the backfill. Reads object
 * bytes exactly like the thumbnail / EXIF pipeline.
 */
export function computeAndStoreContentHash(photoId: number, storageKey: string): Promise<ContentHashResult> {
  return contentHashLimiter(() => computeAndStoreContentHashUnbounded(photoId, storageKey));
}

async function computeAndStoreContentHashUnbounded(photoId: number, storageKey: string): Promise<ContentHashResult> {
  if (!storageKey.startsWith("/objects/")) {
    logger.warn({ photoId, storageKey }, "Cannot compute content hash: unexpected storageKey format");
    return "skipped";
  }

  try {
    const sourceFile = resolveSourceFile(storageKey);
    const [exists] = await sourceFile.exists();
    if (!exists) {
      logger.warn({ photoId, storageKey }, "Source file not found, skipping content hash");
      return "skipped";
    }

    const [sourceBuffer] = await sourceFile.download();
    const hash = createHash("sha256").update(sourceBuffer as Buffer).digest("hex");

    await db.update(photosTable).set({ contentHash: hash }).where(eq(photosTable.id, photoId));
    logger.info({ photoId }, "Content hash computed and stored");
    return "success";
  } catch (err) {
    logger.error({ err, photoId, storageKey }, "Content hash computation failed");
    return "failed";
  }
}

export async function countPhotosWithoutContentHash(): Promise<number> {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(and(isNull(photosTable.contentHash), isNotNull(photosTable.storageKey)));
  return rows.length;
}

export async function backfillContentHashes(): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const photos = await db
    .select({ id: photosTable.id, storageKey: photosTable.storageKey })
    .from(photosTable)
    .where(and(isNull(photosTable.contentHash), isNotNull(photosTable.storageKey)))
    .orderBy(photosTable.createdAt);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    if (!photo.storageKey) {
      skipped++;
      continue;
    }
    const result = await computeAndStoreContentHash(photo.id, photo.storageKey);
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

export interface DuplicatePhoto {
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

export interface DuplicatePhotoGroup {
  contentHash: string;
  photos: DuplicatePhoto[];
}

/**
 * Find groups of photos that share a content hash (byte-identical duplicates).
 * Only groups with 2+ members are returned. Each photo is annotated with
 * whether it is an album cover and how many collections it belongs to, so the
 * UI can warn before deleting a referenced photo. Groups are ordered by hash
 * for a stable pagination order; pass limit/offset to page through them.
 */
export async function listDuplicatePhotoGroups(opts?: {
  limit?: number;
  offset?: number;
}): Promise<DuplicatePhotoGroup[]> {
  let dupHashesQuery = db
    .select({ contentHash: photosTable.contentHash })
    .from(photosTable)
    .where(isNotNull(photosTable.contentHash))
    .groupBy(photosTable.contentHash)
    .having(sql`count(*) > 1`)
    .orderBy(photosTable.contentHash)
    .$dynamic();
  if (opts?.limit != null) dupHashesQuery = dupHashesQuery.limit(opts.limit);
  if (opts?.offset != null) dupHashesQuery = dupHashesQuery.offset(opts.offset);
  const dupHashes = await dupHashesQuery;

  const hashes = dupHashes.map((d) => d.contentHash).filter((h): h is string => h !== null);
  if (hashes.length === 0) return [];

  const rows = await db
    .select({
      id: photosTable.id,
      contentHash: photosTable.contentHash,
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
    .where(inArray(photosTable.contentHash, hashes))
    .orderBy(photosTable.contentHash, desc(photosTable.createdAt));

  const photoIds = rows.map((r) => r.id);
  const collectionCounts = new Map<number, number>();
  if (photoIds.length > 0) {
    const countRows = await db
      .select({ photoId: photoCollectionsTable.photoId, cnt: sql<number>`count(*)::int` })
      .from(photoCollectionsTable)
      .where(inArray(photoCollectionsTable.photoId, photoIds))
      .groupBy(photoCollectionsTable.photoId);
    for (const c of countRows) collectionCounts.set(c.photoId, c.cnt);
  }

  const groups = new Map<string, DuplicatePhotoGroup>();
  for (const r of rows) {
    const hash = r.contentHash!;
    let group = groups.get(hash);
    if (!group) {
      group = { contentHash: hash, photos: [] };
      groups.set(hash, group);
    }
    group.photos.push({
      id: r.id,
      albumId: r.albumId,
      albumTitle: r.albumTitle ?? null,
      filename: r.filename ?? null,
      url: r.url,
      thumbnailKey: r.thumbnailKey ?? null,
      createdAt: r.createdAt,
      isAlbumCover: r.coverPhotoId === r.id,
      collectionCount: collectionCounts.get(r.id) ?? 0,
    });
  }

  return Array.from(groups.values());
}

/**
 * Cheap aggregate for the admin summary: how many duplicate groups exist and
 * how many "extra" copies could be deleted (keeping album covers when a group
 * has any, otherwise one photo per group) — without fetching any group rows.
 */
export async function getDuplicatesSummary(): Promise<{ groupCount: number; extraCount: number }> {
  const result = await db.execute<{ group_count: number; extra_count: number }>(sql`
    SELECT
      count(*)::int AS group_count,
      coalesce(sum(n - greatest(covers, 1)), 0)::int AS extra_count
    FROM (
      SELECT p.content_hash,
             count(*) AS n,
             count(*) FILTER (WHERE a.cover_photo_id = p.id) AS covers
      FROM photos p
      LEFT JOIN albums a ON p.album_id = a.id
      WHERE p.content_hash IS NOT NULL
      GROUP BY p.content_hash
      HAVING count(*) > 1
    ) t
  `);
  const row = result.rows[0];
  return { groupCount: row?.group_count ?? 0, extraCount: row?.extra_count ?? 0 };
}

/**
 * Ids of every deletable duplicate copy, mirroring the UI rule: per group keep
 * the album covers when there are any (covers can't be deleted), otherwise the
 * first (newest) photo, and mark the rest for deletion.
 */
export async function computeDuplicateExtraIds(): Promise<number[]> {
  const groups = await listDuplicatePhotoGroups();
  return groups.flatMap((group) => {
    const hasCover = group.photos.some((p) => p.isAlbumCover);
    const deletable = hasCover
      ? group.photos.filter((p) => !p.isAlbumCover)
      : group.photos.slice(1);
    return deletable.map((p) => p.id);
  });
}
