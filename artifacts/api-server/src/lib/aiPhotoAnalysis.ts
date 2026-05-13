import { eq } from "drizzle-orm";
import {
  db,
  photosTable,
  collectionsTable,
  categoriesTable,
  photoCategoriesTable,
  tagsTable,
  photoTagsTable,
  photoCollectionSuggestionsTable,
  photoTagSuggestionsTable,
  photoCategorySuggestionsTable,
  aiAnalysisEventsTable,
  type AiAnalysisEvent,
} from "@workspace/db";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";
import { getActiveProvider } from "./aiProviders";
import type { ProviderId } from "./aiProviders";

const storageService = new ObjectStorageService();

interface ResolvedImage {
  dataUrl: string;
  contentType: string;
}

async function resolveImageForAI(
  imageUrl: string,
  storageKey: string | null,
): Promise<ResolvedImage> {
  if (storageKey && storageKey.startsWith("/objects/")) {
    try {
      const file = await storageService.getObjectEntityFile(storageKey);
      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();
      const contentType = (metadata.contentType as string) || "image/jpeg";
      return {
        dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
        contentType,
      };
    } catch (err) {
      logger.warn(
        { err, storageKey },
        "Could not fetch private object for AI analysis",
      );
    }
  }
  return { dataUrl: imageUrl, contentType: "image/jpeg" };
}

export interface CollectionForSuggestion {
  id: number;
  title: string;
  description: string | null;
}

export interface CategoryForSuggestion {
  id: number;
  name: string;
}

export interface PhotoAnalysisResult {
  description: string;
  suggestedCollectionIds: number[];
  suggestedTags: string[];
  suggestedCategoryIds: number[];
}

export type AnalyzePhotoOutcome =
  | { status: "success"; provider: ProviderId; result: PhotoAnalysisResult }
  | { status: "skipped"; provider: ProviderId | null; reason: string }
  | { status: "failed"; provider: ProviderId | null; error: string };

export async function analyzePhoto(
  imageUrl: string,
  collections: CollectionForSuggestion[],
  categories: CategoryForSuggestion[],
  storageKey: string | null,
): Promise<AnalyzePhotoOutcome> {
  const { provider, reason } = await getActiveProvider();
  if (!provider) {
    logger.info({ reason }, "Skipping AI photo analysis");
    return { status: "skipped", provider: null, reason: reason ?? "No active provider" };
  }

  const allowedCollectionIds = collections.map((c) => c.id);
  const allowedCategoryIds = categories.map((c) => c.id);
  const collectionsBlock = collections
    .map(
      (c) =>
        `- id=${c.id} | "${c.title}"${c.description ? ` — ${c.description}` : ""}`,
    )
    .join("\n");
  const categoriesBlock = categories
    .map((c) => `- id=${c.id} | "${c.name}"`)
    .join("\n");

  const systemPrompt =
    "You are a photo describer for a team photo album. Look at the photo and (1) write one short, plain-English sentence (max 25 words) describing what is in it; (2) from the user's existing collections, pick up to 3 that this photo would naturally belong in (only clear thematic matches, otherwise empty; never invent collection ids); (3) suggest 3-5 short, lowercase, single-or-two-word tags describing the photo's subject, setting, mood, or activity (no '#', no punctuation); and (4) from the user's existing categories, pick up to 2 best-fit category ids (only clear matches, otherwise empty; never invent category ids).";

  const collectionsText = collections.length
    ? `Existing collections:\n${collectionsBlock}`
    : "The user has no collections yet; return an empty list of suggested collection ids.";
  const categoriesText = categories.length
    ? `Existing categories:\n${categoriesBlock}`
    : "The user has no categories yet; return an empty list of suggested category ids.";

  const userText = `${collectionsText}\n\n${categoriesText}\n\nDescribe the photo, pick up to 3 fitting collection ids, suggest 3-5 short tags, and pick up to 2 fitting category ids.`;

  let image: ResolvedImage;
  let result: Awaited<ReturnType<typeof provider.analyze>>;
  try {
    image = await resolveImageForAI(imageUrl, storageKey);
    result = await provider.analyze({
      imageDataUrl: image.dataUrl,
      contentType: image.contentType,
      systemPrompt,
      userText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", provider: provider.id, error: message };
  }
  if (!result) {
    return {
      status: "failed",
      provider: provider.id,
      error: "Provider returned no result",
    };
  }

  const suggestedCollectionIds = Array.from(
    new Set(
      result.suggestedCollectionIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && allowedCollectionIds.includes(id)),
    ),
  ).slice(0, 3);

  const suggestedTags = Array.from(
    new Set(
      result.suggestedTags
        .map((t) =>
          String(t ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-"),
        )
        .filter((t) => t.length > 0 && t.length <= 32),
    ),
  ).slice(0, 5);

  const suggestedCategoryIds = Array.from(
    new Set(
      result.suggestedCategoryIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && allowedCategoryIds.includes(id)),
    ),
  ).slice(0, 2);

  return {
    status: "success",
    provider: provider.id,
    result: {
      description: result.description,
      suggestedCollectionIds,
      suggestedTags,
      suggestedCategoryIds,
    },
  };
}

/**
 * Run AI analysis for an existing photo and persist the outcome:
 * - Updates `photos.aiDescription` on success
 * - Inserts pending suggestions (collections, tags, categories) on success
 * - Always records an `ai_analysis_events` row describing the attempt
 *
 * Used by the upload flow and by the admin "Retry" action on failed events.
 * Returns the inserted event row, or null if the photo is missing.
 */
export async function runAndRecordPhotoAnalysis(
  photoId: number,
): Promise<AiAnalysisEvent | null> {
  const [photo] = await db
    .select()
    .from(photosTable)
    .where(eq(photosTable.id, photoId));
  if (!photo) return null;

  try {
    const [collections, categories] = await Promise.all([
      db
        .select({
          id: collectionsTable.id,
          title: collectionsTable.title,
          description: collectionsTable.description,
        })
        .from(collectionsTable)
        .where(eq(collectionsTable.createdById, photo.uploaderId)),
      db
        .select({ id: categoriesTable.id, name: categoriesTable.name })
        .from(categoriesTable),
    ]);

    const outcome = await analyzePhoto(
      photo.url,
      collections,
      categories,
      photo.storageKey,
    );

    if (outcome.status === "skipped") {
      const [ev] = await db
        .insert(aiAnalysisEventsTable)
        .values({
          photoId: photo.id,
          provider: outcome.provider,
          status: "skipped",
          errorMessage: outcome.reason,
        })
        .returning();
      return ev;
    }

    if (outcome.status === "failed") {
      const [ev] = await db
        .insert(aiAnalysisEventsTable)
        .values({
          photoId: photo.id,
          provider: outcome.provider,
          status: "failed",
          errorMessage: outcome.error.slice(0, 1000),
        })
        .returning();
      return ev;
    }

    const result = outcome.result;

    await db
      .update(photosTable)
      .set({ aiDescription: result.description || null })
      .where(eq(photosTable.id, photo.id));

    if (result.suggestedCollectionIds.length > 0) {
      await db
        .insert(photoCollectionSuggestionsTable)
        .values(
          result.suggestedCollectionIds.map((cid) => ({
            photoId: photo.id,
            collectionId: cid,
            status: "pending" as const,
          })),
        )
        .onConflictDoNothing();
    }

    if (result.suggestedCategoryIds.length > 0) {
      const existingCats = await db
        .select({ categoryId: photoCategoriesTable.categoryId })
        .from(photoCategoriesTable)
        .where(eq(photoCategoriesTable.photoId, photo.id));
      const existingCatIds = new Set(existingCats.map((c) => c.categoryId));
      const newCatSuggestions = result.suggestedCategoryIds.filter(
        (cid) => !existingCatIds.has(cid),
      );
      if (newCatSuggestions.length > 0) {
        await db
          .insert(photoCategorySuggestionsTable)
          .values(
            newCatSuggestions.map((cid) => ({
              photoId: photo.id,
              categoryId: cid,
              status: "pending" as const,
            })),
          )
          .onConflictDoNothing();
      }
    }

    if (result.suggestedTags.length > 0) {
      const existingTags = await db
        .select({ name: tagsTable.name })
        .from(tagsTable)
        .innerJoin(photoTagsTable, eq(tagsTable.id, photoTagsTable.tagId))
        .where(eq(photoTagsTable.photoId, photo.id));
      const existingNames = new Set(existingTags.map((t) => t.name));
      const newSuggestions = result.suggestedTags.filter(
        (t) => !existingNames.has(t),
      );

      if (newSuggestions.length > 0) {
        await db
          .insert(photoTagSuggestionsTable)
          .values(
            newSuggestions.map((tagName) => ({
              photoId: photo.id,
              tagName,
              status: "pending" as const,
            })),
          )
          .onConflictDoNothing();
      }
    }

    const [ev] = await db
      .insert(aiAnalysisEventsTable)
      .values({
        photoId: photo.id,
        provider: outcome.provider,
        status: "success",
      })
      .returning();
    return ev;
  } catch (err) {
    logger.error({ err, photoId }, "AI analysis failed");
    try {
      const message = err instanceof Error ? err.message : String(err);
      const [ev] = await db
        .insert(aiAnalysisEventsTable)
        .values({
          photoId,
          provider: null,
          status: "failed",
          errorMessage: message.slice(0, 1000),
        })
        .returning();
      return ev;
    } catch (logErr) {
      logger.error({ err: logErr }, "Failed to record AI analysis failure event");
      return null;
    }
  }
}
