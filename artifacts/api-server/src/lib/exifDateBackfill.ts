import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db, photosTable } from "@workspace/db";
import { objectStorageClient } from "./objectStorage";
import { extractExifDate } from "./thumbnailGeneration";
import { logger } from "./logger";

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const parts = path.split("/");
  if (parts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  return {
    bucketName: parts[1],
    objectName: parts.slice(2).join("/"),
  };
}

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }
  return dir;
}

export async function countPhotosWithoutCaptureDate(organizationId?: number): Promise<number> {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(
      and(
        isNull(photosTable.takenAt),
        isNotNull(photosTable.storageKey),
        organizationId != null ? eq(photosTable.organizationId, organizationId) : undefined,
      ),
    );
  return rows.length;
}

export async function backfillExifDates(organizationId?: number): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const photos = await db
    .select({ id: photosTable.id, storageKey: photosTable.storageKey })
    .from(photosTable)
    .where(
      and(
        isNull(photosTable.takenAt),
        isNotNull(photosTable.storageKey),
        organizationId != null ? eq(photosTable.organizationId, organizationId) : undefined,
      ),
    );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const privateObjectDir = getPrivateObjectDir();
  const entityDirBase = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;

  for (const photo of photos) {
    if (!photo.storageKey) {
      skipped++;
      continue;
    }

    if (!photo.storageKey.startsWith("/objects/")) {
      logger.warn({ photoId: photo.id, storageKey: photo.storageKey }, "Unexpected storageKey format, skipping EXIF backfill");
      skipped++;
      continue;
    }

    try {
      const entityId = photo.storageKey.slice("/objects/".length);
      const objectEntityPath = `${entityDirBase}${entityId}`;
      const { bucketName, objectName } = parseObjectPath(objectEntityPath);

      const bucket = objectStorageClient.bucket(bucketName);
      const sourceFile = bucket.file(objectName);

      const [exists] = await sourceFile.exists();
      if (!exists) {
        logger.warn({ photoId: photo.id, storageKey: photo.storageKey }, "Source file not found, skipping EXIF date backfill");
        skipped++;
        continue;
      }

      const [sourceBuffer] = await sourceFile.download();
      const exifDate = await extractExifDate(sourceBuffer as Buffer);

      if (!exifDate) {
        skipped++;
        continue;
      }

      await db
        .update(photosTable)
        .set({ takenAt: exifDate })
        .where(eq(photosTable.id, photo.id));

      logger.info({ photoId: photo.id, takenAt: exifDate }, "Backfilled takenAt from EXIF data");
      updated++;
    } catch (err) {
      logger.error({ err, photoId: photo.id }, "EXIF date backfill failed for photo");
      failed++;
    }
  }

  return { processed: photos.length, updated, skipped, failed };
}
