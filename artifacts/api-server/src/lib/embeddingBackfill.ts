import { sql, isNotNull, and, eq } from "drizzle-orm";
import { db, photosTable } from "@workspace/db";
import { generateAndStorePhotoEmbedding } from "./aiEmbedding";
import { logger } from "./logger";

// Photos that have a storageKey (so bytes are fetchable) but no embedding yet.
const needsEmbedding = and(
  isNotNull(photosTable.storageKey),
  sql`NOT EXISTS (SELECT 1 FROM photo_embeddings pe WHERE pe.photo_id = ${photosTable.id})`,
);

// Scope to one org (#113) when an id is given; otherwise instance-wide.
function needsEmbeddingIn(organizationId?: number) {
  return organizationId != null
    ? and(needsEmbedding, eq(photosTable.organizationId, organizationId))
    : needsEmbedding;
}

export async function countPhotosNeedingEmbedding(organizationId?: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(photosTable)
    .where(needsEmbeddingIn(organizationId));
  return row?.n ?? 0;
}

export async function backfillEmbeddings(limit?: number, organizationId?: number): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const base = db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(needsEmbeddingIn(organizationId))
    .orderBy(photosTable.createdAt);
  const photos = limit != null ? await base.limit(limit) : await base;

  let succeeded = 0;
  let failed = 0;
  for (const photo of photos) {
    try {
      const ok = await generateAndStorePhotoEmbedding(photo.id);
      if (ok) succeeded++;
      else failed++;
    } catch (err) {
      failed++;
      logger.warn({ err, photoId: photo.id }, "Embedding backfill failed for photo");
    }
  }
  return { processed: photos.length, succeeded, failed };
}
