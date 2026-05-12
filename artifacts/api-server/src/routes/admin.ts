import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  appSettingsTable,
  APP_SETTINGS_SINGLETON_ID,
  aiAnalysisEventsTable,
  photosTable,
} from "@workspace/db";
import {
  GetAiSettingsResponse,
  UpdateAiSettingsBody,
  UpdateAiSettingsResponse,
  SetAiProviderKeyParams,
  SetAiProviderKeyBody,
  SetAiProviderKeyResponse,
  ClearAiProviderKeyParams,
  ClearAiProviderKeyResponse,
  ListAiAnalysisEventsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAuth";
import {
  loadAppSettings,
  summarizeSettings,
  PROVIDER_IDS,
  type ProviderId,
} from "../lib/aiProviders";
import { encryptSecret, maskKey } from "../lib/secretCrypto";

const router: IRouter = Router();

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
      photoCaption: photosTable.caption,
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
        photoCaption: r.photoCaption,
        photoThumbnailUrl: r.photoThumbnailUrl,
        provider: r.provider,
        status: r.status,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

export default router;
