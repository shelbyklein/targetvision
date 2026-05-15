import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  pool,
  appSettingsTable,
  APP_SETTINGS_SINGLETON_ID,
  aiAnalysisEventsTable,
  photosTable,
} from "@workspace/db";
import {
  GetRegistrationSettingsResponse,
  UpdateRegistrationSettingsBody,
  UpdateRegistrationSettingsResponse,
  GetAiSettingsResponse,
  UpdateAiSettingsBody,
  UpdateAiSettingsResponse,
  SetAiProviderKeyParams,
  SetAiProviderKeyBody,
  SetAiProviderKeyResponse,
  ClearAiProviderKeyParams,
  ClearAiProviderKeyResponse,
  ListAiAnalysisEventsResponse,
  RetryAiAnalysisEventParams,
  RetryAiAnalysisEventResponse,
  BulkRetryAiAnalysisEventsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAuth";
import {
  loadAppSettings,
  summarizeSettings,
  PROVIDER_IDS,
  PROVIDER_MODEL_OPTIONS,
  type ProviderId,
} from "../lib/aiProviders";
import { encryptSecret, maskKey } from "../lib/secretCrypto";
import { runAndRecordPhotoAnalysis } from "../lib/aiPhotoAnalysis";

const router: IRouter = Router();

router.get("/registration-settings", async (_req, res): Promise<void> => {
  const settings = await loadAppSettings();
  res.json(GetRegistrationSettingsResponse.parse({ registrationEnabled: settings.registrationEnabled }));
});

router.patch("/admin/registration-settings", requireAdmin, async (req, res): Promise<void> => {
  const body = UpdateRegistrationSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  await loadAppSettings();
  const [updated] = await db
    .update(appSettingsTable)
    .set({ registrationEnabled: body.data.registrationEnabled, updatedAt: new Date() })
    .where(eq(appSettingsTable.id, APP_SETTINGS_SINGLETON_ID))
    .returning();

  res.json(UpdateRegistrationSettingsResponse.parse({ registrationEnabled: updated.registrationEnabled }));
});

router.get("/admin/ai-settings", requireAdmin, async (_req, res): Promise<void> => {
  const settings = await loadAppSettings();
  res.json(GetAiSettingsResponse.parse(summarizeSettings(settings)));
});

router.patch("/admin/ai-settings", requireAdmin, async (req, res): Promise<void> => {
  const body = UpdateAiSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  await loadAppSettings();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.data.enabled === "boolean") updates.aiEnabled = body.data.enabled;
  if (body.data.activeProvider) updates.activeProvider = body.data.activeProvider;

  const providerModels = body.data.providerModels;
  if (providerModels) {
    const modelColumns: Record<ProviderId, "openaiModel" | "anthropicModel" | "geminiModel"> = {
      openai: "openaiModel",
      anthropic: "anthropicModel",
      gemini: "geminiModel",
    };
    for (const id of PROVIDER_IDS) {
      const requested = providerModels[id];
      if (typeof requested !== "string") continue;
      if (!PROVIDER_MODEL_OPTIONS[id].includes(requested)) {
        res.status(400).json({
          error: `Unsupported model "${requested}" for provider "${id}"`,
        });
        return;
      }
      updates[modelColumns[id]] = requested;
    }
  }

  const [updated] = await db
    .update(appSettingsTable)
    .set(updates)
    .where(eq(appSettingsTable.id, APP_SETTINGS_SINGLETON_ID))
    .returning();

  res.json(UpdateAiSettingsResponse.parse(summarizeSettings(updated)));
});

function keyColumns(provider: ProviderId) {
  if (provider === "openai") {
    return {
      ciphertext: "openaiKeyCiphertext",
      iv: "openaiKeyIv",
      tag: "openaiKeyTag",
      preview: "openaiKeyPreview",
    } as const;
  }
  if (provider === "anthropic") {
    return {
      ciphertext: "anthropicKeyCiphertext",
      iv: "anthropicKeyIv",
      tag: "anthropicKeyTag",
      preview: "anthropicKeyPreview",
    } as const;
  }
  return {
    ciphertext: "geminiKeyCiphertext",
    iv: "geminiKeyIv",
    tag: "geminiKeyTag",
    preview: "geminiKeyPreview",
  } as const;
}

router.put(
  "/admin/ai-settings/providers/:provider/key",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetAiProviderKeyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = SetAiProviderKeyBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const provider = params.data.provider as ProviderId;
    if (!PROVIDER_IDS.includes(provider)) {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }

    await loadAppSettings();
    const apiKey = body.data.apiKey.trim();
    const enc = encryptSecret(apiKey);
    const cols = keyColumns(provider);
    const [updated] = await db
      .update(appSettingsTable)
      .set({
        [cols.ciphertext]: enc.ciphertext,
        [cols.iv]: enc.iv,
        [cols.tag]: enc.tag,
        [cols.preview]: maskKey(apiKey),
        updatedAt: new Date(),
      })
      .where(eq(appSettingsTable.id, APP_SETTINGS_SINGLETON_ID))
      .returning();

    res.json(SetAiProviderKeyResponse.parse(summarizeSettings(updated)));
  },
);

router.delete(
  "/admin/ai-settings/providers/:provider/key",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ClearAiProviderKeyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const provider = params.data.provider as ProviderId;
    if (!PROVIDER_IDS.includes(provider)) {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }

    await loadAppSettings();
    const cols = keyColumns(provider);
    const [updated] = await db
      .update(appSettingsTable)
      .set({
        [cols.ciphertext]: null,
        [cols.iv]: null,
        [cols.tag]: null,
        [cols.preview]: null,
        updatedAt: new Date(),
      })
      .where(eq(appSettingsTable.id, APP_SETTINGS_SINGLETON_ID))
      .returning();

    res.json(ClearAiProviderKeyResponse.parse(summarizeSettings(updated)));
  },
);

router.get("/admin/ai-analysis-events", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: aiAnalysisEventsTable.id,
      photoId: aiAnalysisEventsTable.photoId,
      provider: aiAnalysisEventsTable.provider,
      status: aiAnalysisEventsTable.status,
      errorMessage: aiAnalysisEventsTable.errorMessage,
      createdAt: aiAnalysisEventsTable.createdAt,
      photoThumbnailUrl: photosTable.url,
    })
    .from(aiAnalysisEventsTable)
    .leftJoin(photosTable, eq(photosTable.id, aiAnalysisEventsTable.photoId))
    .orderBy(desc(aiAnalysisEventsTable.createdAt))
    .limit(20);

  res.json(
    ListAiAnalysisEventsResponse.parse(
      rows.map((r) => ({
        id: r.id,
        photoId: r.photoId,
        photoCaption: null,
        photoThumbnailUrl: r.photoThumbnailUrl,
        provider: r.provider,
        status: r.status,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

router.post(
  "/admin/ai-analysis-events/retry-all",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const recentEvents = await db
      .select({
        id: aiAnalysisEventsTable.id,
        photoId: aiAnalysisEventsTable.photoId,
        status: aiAnalysisEventsTable.status,
      })
      .from(aiAnalysisEventsTable)
      .orderBy(desc(aiAnalysisEventsTable.createdAt))
      .limit(20);

    const failedPhotoIds = Array.from(
      new Set(
        recentEvents
          .filter((e) => e.status === "failed" && e.photoId != null)
          .map((e) => e.photoId as number),
      ),
    );

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;

    for (const photoId of failedPhotoIds) {
      const newEvent = await runAndRecordPhotoAnalysis(photoId);
      if (!newEvent || newEvent.status === "failed") {
        failed++;
      } else if (newEvent.status === "skipped") {
        skipped++;
      } else {
        succeeded++;
      }
    }

    res.json(BulkRetryAiAnalysisEventsResponse.parse({ succeeded, skipped, failed }));
  },
);

router.post(
  "/admin/ai-analysis-events/:id/retry",
  requireAdmin,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const params = RetryAiAnalysisEventParams.safeParse({
      id: parseInt(raw, 10),
    });
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [event] = await db
      .select()
      .from(aiAnalysisEventsTable)
      .where(eq(aiAnalysisEventsTable.id, params.data.id));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (event.status !== "failed") {
      res.status(400).json({ error: "Only failed events can be retried" });
      return;
    }
    if (event.photoId == null) {
      res.status(404).json({ error: "Photo no longer exists" });
      return;
    }

    const newEvent = await runAndRecordPhotoAnalysis(event.photoId);
    if (!newEvent) {
      res.status(404).json({ error: "Photo no longer exists" });
      return;
    }

    const [row] = await db
      .select({
        id: aiAnalysisEventsTable.id,
        photoId: aiAnalysisEventsTable.photoId,
        provider: aiAnalysisEventsTable.provider,
        status: aiAnalysisEventsTable.status,
        errorMessage: aiAnalysisEventsTable.errorMessage,
        createdAt: aiAnalysisEventsTable.createdAt,
        photoThumbnailUrl: photosTable.url,
      })
      .from(aiAnalysisEventsTable)
      .leftJoin(photosTable, eq(photosTable.id, aiAnalysisEventsTable.photoId))
      .where(eq(aiAnalysisEventsTable.id, newEvent.id));

    res.json(
      RetryAiAnalysisEventResponse.parse({
        id: row.id,
        photoId: row.photoId,
        photoCaption: null,
        photoThumbnailUrl: row.photoThumbnailUrl,
        provider: row.provider,
        status: row.status,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt.toISOString(),
      }),
    );
  },
);

router.post("/migrate/add-collection-cover-photo", async (req, res): Promise<void> => {
  const secret = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!secret || req.headers["x-bootstrap-secret"] !== secret) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  try {
    await pool.query(`
      ALTER TABLE collections
      ADD COLUMN IF NOT EXISTS cover_photo_id integer REFERENCES photos(id) ON DELETE SET NULL
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS collection_tags (
        collection_id integer NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        tag_id integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (collection_id, tag_id)
      )
    `);
    res.json({ ok: true, message: "cover_photo_id and collection_tags applied" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
