import sharp from "sharp";
import { and, eq, isNull } from "drizzle-orm";
import { db, photosTable } from "@workspace/db";
import { objectStorageClient, parseObjectPath, getPrivateObjectDir } from "./objectStorage";
import { extractDisplayDimensions } from "./thumbnailGeneration";
import { logger } from "./logger";

/**
 * Backfill photo width/height for rows that predate the dimension columns.
 *
 * Prefers the stored thumbnail over the original: it's a ~600px download
 * instead of a full-size one, and legacy thumbnails were written without
 * rotating (orientation tag stripped, pixels as stored), so the thumbnail's
 * own pixel grid IS the aspect ratio the grid actually renders. Falls back to
 * the original (orientation-corrected) when a photo has no thumbnail.
 */
export async function countPhotosWithoutDimensions(organizationId?: number): Promise<number> {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(
      and(
        isNull(photosTable.width),
        organizationId != null ? eq(photosTable.organizationId, organizationId) : undefined,
      ),
    );
  return rows.length;
}

function resolveObjectFile(key: string) {
  const privateObjectDir = getPrivateObjectDir();
  const entityDirBase = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;
  const entityId = key.slice("/objects/".length);
  const { bucketName, objectName } = parseObjectPath(`${entityDirBase}${entityId}`);
  return objectStorageClient.bucket(bucketName).file(objectName);
}

export async function backfillDimensions(organizationId?: number): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const photos = await db
    .select({
      id: photosTable.id,
      storageKey: photosTable.storageKey,
      thumbnailKey: photosTable.thumbnailKey,
    })
    .from(photosTable)
    .where(
      and(
        isNull(photosTable.width),
        organizationId != null ? eq(photosTable.organizationId, organizationId) : undefined,
      ),
    );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    // Thumbnail first (small download, matches rendered aspect); original as
    // fallback for photos that never got a thumbnail.
    const candidates = [
      { key: photo.thumbnailKey, correctOrientation: false },
      { key: photo.storageKey, correctOrientation: true },
    ].filter((c): c is { key: string; correctOrientation: boolean } =>
      Boolean(c.key && c.key.startsWith("/objects/")),
    );

    if (candidates.length === 0) {
      skipped++;
      continue;
    }

    try {
      let dimensions: { width: number; height: number } | null = null;
      for (const { key, correctOrientation } of candidates) {
        const file = resolveObjectFile(key);
        const [exists] = await file.exists();
        if (!exists) continue;
        const [buffer] = await file.download();
        const metadata = await sharp(buffer as Buffer).metadata();
        dimensions = correctOrientation
          ? extractDisplayDimensions(metadata)
          : metadata.width && metadata.height
            ? { width: metadata.width, height: metadata.height }
            : null;
        if (dimensions) break;
      }

      if (!dimensions) {
        skipped++;
        continue;
      }

      await db.update(photosTable).set(dimensions).where(eq(photosTable.id, photo.id));
      updated++;
    } catch (err) {
      logger.error({ err, photoId: photo.id }, "Dimension backfill failed for photo");
      failed++;
    }
  }

  logger.info({ processed: photos.length, updated, skipped, failed }, "Dimension backfill complete");
  return { processed: photos.length, updated, skipped, failed };
}
