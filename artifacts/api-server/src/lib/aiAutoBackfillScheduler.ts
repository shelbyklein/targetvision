import { db, organizationsTable, organizationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadOrgSettings } from "./aiProviders";
import { backfillAiAnalysis, countPhotosNeedingAiAnalysis } from "./aiAnalysisBackfill";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let isRunning = false;

// Per-org (#113): each org opts into automatic AI backfill independently, and a
// tick only processes that org's own photos with that org's provider/key.
async function tick(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  try {
    const orgs = await db.select({ id: organizationsTable.id }).from(organizationsTable);
    for (const org of orgs) {
      const settings = await loadOrgSettings(org.id);
      if (!settings.aiAutoBackfillEnabled) continue;

      const missingCount = await countPhotosNeedingAiAnalysis(org.id);
      if (missingCount === 0) continue;

      const batchSize = settings.aiAutoBackfillBatchSize;
      logger.info(
        { orgId: org.id, missingCount, batchSize },
        "Automatic AI analysis backfill: starting batch",
      );
      const result = await backfillAiAnalysis(batchSize, "automatic", org.id);
      logger.info({ orgId: org.id, ...result }, "Automatic AI analysis backfill: batch complete");
    }
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

export async function getAiAutoBackfillSettings(organizationId: number): Promise<{
  enabled: boolean;
  batchSize: number;
}> {
  const settings = await loadOrgSettings(organizationId);
  return { enabled: settings.aiAutoBackfillEnabled, batchSize: settings.aiAutoBackfillBatchSize };
}

export async function updateAiAutoBackfillSettings(
  organizationId: number,
  input: { enabled?: boolean; batchSize?: number },
): Promise<{ enabled: boolean; batchSize: number }> {
  await loadOrgSettings(organizationId);
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.enabled !== undefined) updates.aiAutoBackfillEnabled = input.enabled;
  if (input.batchSize !== undefined) updates.aiAutoBackfillBatchSize = input.batchSize;

  const [updated] = await db
    .update(organizationSettingsTable)
    .set(updates)
    .where(eq(organizationSettingsTable.organizationId, organizationId))
    .returning();

  return { enabled: updated.aiAutoBackfillEnabled, batchSize: updated.aiAutoBackfillBatchSize };
}
