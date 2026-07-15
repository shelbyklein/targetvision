import { and, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db, photosTable, aiBackfillRunsTable, aiAnalysisEventsTable, type AiBackfillRun } from "@workspace/db";
import { runAndRecordPhotoAnalysis } from "./aiPhotoAnalysis";
import { logger } from "./logger";

export type BackfillTrigger = "manual" | "automatic";

// After this many failed analysis attempts, stop auto/bulk-retrying a photo: its
// image is almost certainly unprocessable (corrupt / unsupported), and retrying
// it every scheduler cycle just floods the AI activity log with the same error.
// Admins can still force a retry per-photo from the activity view — that path
// calls runAndRecordPhotoAnalysis directly and bypasses this cap.
export const MAX_AUTO_ANALYSIS_ATTEMPTS = 3;

// Photo ids that have hit the failed-attempt cap, to exclude from bulk analysis.
async function cappedPhotoIds(): Promise<number[]> {
  const rows = await db
    .select({ photoId: aiAnalysisEventsTable.photoId })
    .from(aiAnalysisEventsTable)
    .where(eq(aiAnalysisEventsTable.status, "failed"))
    .groupBy(aiAnalysisEventsTable.photoId)
    .having(sql`count(*) >= ${MAX_AUTO_ANALYSIS_ATTEMPTS}`);
  return rows.map((r) => r.photoId).filter((id): id is number => id != null);
}

// Photos that still want an AI description and haven't exhausted their retries.
async function eligibleForAnalysis() {
  const capped = await cappedPhotoIds();
  return capped.length > 0
    ? and(isNull(photosTable.aiDescription), notInArray(photosTable.id, capped))
    : isNull(photosTable.aiDescription);
}

export async function countPhotosNeedingAiAnalysis(): Promise<number> {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(await eligibleForAnalysis());
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
    .where(await eligibleForAnalysis())
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
