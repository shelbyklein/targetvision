import { desc, isNull } from "drizzle-orm";
import { db, photosTable, aiBackfillRunsTable, type AiBackfillRun } from "@workspace/db";
import { runAndRecordPhotoAnalysis } from "./aiPhotoAnalysis";
import { logger } from "./logger";

export type BackfillTrigger = "manual" | "automatic";

export async function countPhotosNeedingAiAnalysis(): Promise<number> {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(isNull(photosTable.aiDescription));
  return rows.length;
}

export async function backfillAiAnalysis(
  limit?: number,
  trigger: BackfillTrigger = "manual",
): Promise<{
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
}> {
  const baseQuery = db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(isNull(photosTable.aiDescription))
    .orderBy(photosTable.createdAt);
  const photos = limit != null ? await baseQuery.limit(limit) : await baseQuery;

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    const event = await runAndRecordPhotoAnalysis(photo.id);
    if (!event || event.status === "failed") {
      failed++;
      logger.warn({ photoId: photo.id }, "AI analysis backfill failed for photo");
    } else if (event.status === "skipped") {
      skipped++;
    } else {
      succeeded++;
    }
  }

  const result = { processed: photos.length, succeeded, skipped, failed };

  await db.insert(aiBackfillRunsTable).values({
    trigger,
    requestedLimit: limit ?? null,
    ...result,
  });

  return result;
}

export async function listAiBackfillRuns(limit = 20): Promise<AiBackfillRun[]> {
  return db
    .select()
    .from(aiBackfillRunsTable)
    .orderBy(desc(aiBackfillRunsTable.createdAt))
    .limit(limit);
}
