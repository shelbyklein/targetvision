import { eq } from "drizzle-orm";
import { GoogleAuth } from "google-auth-library";
import {
  db,
  appSettingsTable,
  APP_SETTINGS_SINGLETON_ID,
  photosTable,
  photoEmbeddingsTable,
  EMBEDDING_DIMENSION,
} from "@workspace/db";
import { resolveImageForAI } from "./aiPhotoAnalysis";
import { createLimiter } from "./concurrencyLimit";
import { logger } from "./logger";

// Google Vertex AI multimodal embedding model. Images and text queries land in
// the same 1408-dim space, so a text query retrieves images and image↔image
// similarity works. See lib/db photoEmbeddings.ts for the fixed dimension.
export const VERTEX_EMBEDDING_MODEL = "multimodalembedding@001";
export const EMBEDDING_MODEL_TAG = `vertex/${VERTEX_EMBEDDING_MODEL}`;

// Bound concurrent image embeds — each holds a downscaled image in memory while
// the Vertex call is in flight, and uploads fire these without awaiting.
const embeddingLimiter = createLimiter(2);

function vertexConfig(): { project: string | null; location: string } {
  return {
    project: process.env.VERTEX_PROJECT || null,
    location: process.env.VERTEX_LOCATION || "us-central1",
  };
}

let cachedAuth: GoogleAuth | null = null;
function googleAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  }
  return cachedAuth;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const client = await googleAuth().getClient();
    const token = await client.getAccessToken();
    return token.token ?? null;
  } catch (err) {
    logger.error({ err }, "Vertex ADC token acquisition failed (check GOOGLE_APPLICATION_CREDENTIALS)");
    return null;
  }
}

type EmbedInstance = { image: { bytesBase64Encoded: string } } | { text: string };

// Low-level call to the Vertex :predict endpoint. Returns null (never throws) on
// any config/auth/HTTP/shape error, so callers degrade gracefully.
async function callVertexEmbedding(instance: EmbedInstance): Promise<number[] | null> {
  const { project, location } = vertexConfig();
  if (!project) {
    logger.warn("VERTEX_PROJECT is not set — skipping embedding");
    return null;
  }
  const token = await getAccessToken();
  if (!token) return null;

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${VERTEX_EMBEDDING_MODEL}:predict`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [instance] }),
    });
  } catch (err) {
    logger.error({ err }, "Vertex embedding request failed (network)");
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body: body.slice(0, 500) }, "Vertex embedding request failed");
    return null;
  }

  const json = (await res.json().catch(() => null)) as {
    predictions?: Array<{ imageEmbedding?: number[]; textEmbedding?: number[] }>;
  } | null;
  const pred = json?.predictions?.[0];
  const vec = pred?.imageEmbedding ?? pred?.textEmbedding;
  if (!vec || vec.length !== EMBEDDING_DIMENSION) {
    logger.error({ length: vec?.length, expected: EMBEDDING_DIMENSION }, "Vertex embedding: unexpected response");
    return null;
  }
  return vec;
}

/** Embed a natural-language query (for semantic search). Not concurrency-bounded
 *  so search stays responsive. Returns null when embeddings can't be produced. */
export async function embedText(query: string): Promise<number[] | null> {
  const q = query.trim();
  if (!q) return null;
  return callVertexEmbedding({ text: q });
}

async function isEmbeddingEnabled(): Promise<boolean> {
  const [s] = await db
    .select({ enabled: appSettingsTable.embeddingEnabled })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, APP_SETTINGS_SINGLETON_ID));
  return Boolean(s?.enabled);
}

/**
 * Generate and upsert the image embedding for one photo. No-ops (returns false)
 * when embeddings are disabled, the photo/image is unavailable, or Vertex isn't
 * configured — so it's safe to fire-and-forget on upload and to run in CI.
 */
export async function generateAndStorePhotoEmbedding(photoId: number): Promise<boolean> {
  if (!(await isEmbeddingEnabled())) return false;

  const [photo] = await db
    .select({ url: photosTable.url, storageKey: photosTable.storageKey, organizationId: photosTable.organizationId })
    .from(photosTable)
    .where(eq(photosTable.id, photoId));
  if (!photo) return false;

  const { dataUrl } = await resolveImageForAI(photo.url, photo.storageKey);
  // Vertex needs the raw image bytes; resolveImageForAI only base64-encodes when
  // the object is fetchable from storage (data: URL). A bare remote URL can't be
  // embedded here.
  if (!dataUrl.startsWith("data:")) {
    logger.warn({ photoId }, "No fetchable image bytes for embedding — skipping");
    return false;
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

  const vec = await embeddingLimiter(() =>
    callVertexEmbedding({ image: { bytesBase64Encoded: base64 } }),
  );
  if (!vec) return false;

  await db
    .insert(photoEmbeddingsTable)
    // organizationId denormalized from the photo (#113) so vector search can
    // stay within a tenant without a join when needed.
    .values({ photoId, organizationId: photo.organizationId, embedding: vec, model: EMBEDDING_MODEL_TAG })
    .onConflictDoUpdate({
      target: photoEmbeddingsTable.photoId,
      set: { embedding: vec, model: EMBEDDING_MODEL_TAG, createdAt: new Date(), organizationId: photo.organizationId },
    });
  return true;
}

export interface EmbeddingConfigStatus {
  enabled: boolean;
  projectConfigured: boolean;
  credentialsConfigured: boolean;
  model: string;
  location: string;
}

/** Config snapshot for the admin UI (no network call). */
export async function getEmbeddingConfigStatus(): Promise<EmbeddingConfigStatus> {
  const { project, location } = vertexConfig();
  return {
    enabled: await isEmbeddingEnabled(),
    projectConfigured: Boolean(project),
    credentialsConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    model: VERTEX_EMBEDDING_MODEL,
    location,
  };
}
