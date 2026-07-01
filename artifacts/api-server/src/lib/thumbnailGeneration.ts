import sharp from "sharp";
import exifReader from "exif-reader";
import { randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";
import { db, photosTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "./logger";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const THUMBNAIL_WIDTH = 600;

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

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to sign object URL, status: ${response.status}`);
  }
  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set");
  }
  return dir;
}

function parseExifDateValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  // EXIF date strings use "YYYY:MM:DD HH:MM:SS" format
  const match = String(value).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, min, sec] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec)));
  return isNaN(date.getTime()) ? null : date;
}

export async function extractExifDate(buffer: Buffer): Promise<Date | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.exif) return null;
    const exif = exifReader(metadata.exif);
    const rawDate = (exif.Photo?.DateTimeOriginal ?? exif.Image?.DateTime) as Date | string | null | undefined;
    return parseExifDateValue(rawDate);
  } catch {
    return null;
  }
}

export type ThumbnailResult = "success" | "skipped" | "failed";

const inProgressPhotoIds = new Set<number>();

export async function generateAndStoreThumbnail(photoId: number, storageKey: string): Promise<ThumbnailResult> {
  if (inProgressPhotoIds.has(photoId)) {
    logger.info({ photoId }, "Thumbnail generation already in progress for photo, skipping duplicate");
    return "skipped";
  }

  const claimed = await db
    .update(photosTable)
    .set({ thumbnailGenerating: true })
    .where(and(eq(photosTable.id, photoId), eq(photosTable.thumbnailGenerating, false)))
    .returning({ id: photosTable.id });

  if (claimed.length === 0) {
    logger.info({ photoId }, "Thumbnail generation already claimed by another process, skipping duplicate");
    return "skipped";
  }

  inProgressPhotoIds.add(photoId);
  try {
    if (!storageKey.startsWith("/objects/")) {
      logger.warn({ photoId, storageKey }, "Cannot generate thumbnail: unexpected storageKey format");
      return "skipped";
    }

    const privateObjectDir = getPrivateObjectDir();
    const entityId = storageKey.slice("/objects/".length);
    let entityDir = privateObjectDir;
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const sourceFile = bucket.file(objectName);

    const [exists] = await sourceFile.exists();
    if (!exists) {
      logger.warn({ photoId, storageKey }, "Source file not found, skipping thumbnail generation");
      return "skipped";
    }

    const [sourceBuffer] = await sourceFile.download();

    const thumbnailBuffer = await sharp(sourceBuffer)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    const thumbnailId = randomUUID();
    const thumbnailPath = `${entityDir}thumbnails/${thumbnailId}`;
    const { bucketName: thumbBucket, objectName: thumbObject } = parseObjectPath(thumbnailPath);

    const uploadURL = await signObjectURL({
      bucketName: thumbBucket,
      objectName: thumbObject,
      method: "PUT",
      ttlSec: 900,
    });

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: thumbnailBuffer,
      signal: AbortSignal.timeout(60_000),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Thumbnail upload failed with status ${uploadResponse.status}`);
    }

    const thumbnailKey = `/objects/thumbnails/${thumbnailId}`;

    await db
      .update(photosTable)
      .set({ thumbnailKey })
      .where(eq(photosTable.id, photoId));

    const exifDate = await extractExifDate(sourceBuffer);
    if (exifDate) {
      const updated = await db
        .update(photosTable)
        .set({ takenAt: exifDate })
        .where(and(eq(photosTable.id, photoId), isNull(photosTable.takenAt)))
        .returning({ id: photosTable.id });
      if (updated.length > 0) {
        logger.info({ photoId, takenAt: exifDate }, "takenAt populated from EXIF data");
      }
    }

    logger.info({ photoId, thumbnailKey }, "Thumbnail generated and stored");
    return "success";
  } catch (err) {
    logger.error({ err, photoId, storageKey }, "Thumbnail generation failed");
    return "failed";
  } finally {
    inProgressPhotoIds.delete(photoId);
    await db
      .update(photosTable)
      .set({ thumbnailGenerating: false })
      .where(eq(photosTable.id, photoId));
  }
}
