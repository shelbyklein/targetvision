import { db, appSettingsTable, APP_SETTINGS_SINGLETON_ID } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadAppSettings } from "./aiProviders";
import { backfillAiAnalysis, countPhotosNeedingAiAnalysis } from "./aiAnalysisBackfill";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let isRunning = false;

async function tick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const settings = await loadAppSettings();
    if (!settings.aiAutoBackfillEnabled) return;

    const missingCount = await countPhotosNeedingAiAnalysis();
    if (missingCount === 0) return;

    const batchSize = settings.aiAutoBackfillBatchSize;
    logger.info(
      { missingCount, batchSize },
      "Automatic AI analysis backfill: starting batch",
    );
    const result = await backfillAiAnalysis(batchSize, "automatic");
    logger.info(result, "Automatic AI analysis backfill: batch complete");
  } catch (err) {
    logger.error({ err }, "Automatic AI analysis backfill: unexpected error");
  } finally {
    isRunning = false;
  }
}

export function startAiAutoBackfillScheduler(): void {
  setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
}

export async function getAiAutoBackfillSettings(): Promise<{
  enabled: boolean;
  batchSize: number;
}> {
  const settings = await loadAppSettings();
  return { enabled: settings.aiAutoBackfillEnabled, batchSize: settings.aiAutoBackfillBatchSize };
}

export async function updateAiAutoBackfillSettings(input: {
  enabled?: boolean;
  batchSize?: number;
}): Promise<{ enabled: boolean; batchSize: number }> {
  await loadAppSettings();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.enabled !== undefined) updates.aiAutoBackfillEnabled = input.enabled;
  if (input.batchSize !== undefined) updates.aiAutoBackfillBatchSize = input.batchSize;

  const [updated] = await db
    .update(appSettingsTable)
    .set(updates)
    .where(eq(appSettingsTable.id, APP_SETTINGS_SINGLETON_ID))
    .returning();

  return { enabled: updated.aiAutoBackfillEnabled, batchSize: updated.aiAutoBackfillBatchSize };
}
