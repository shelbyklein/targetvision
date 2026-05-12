import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";
import { getActiveProvider } from "./aiProviders";

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

export interface PhotoAnalysisResult {
  description: string;
  suggestedCollectionIds: number[];
  suggestedTags: string[];
}

export async function analyzePhoto(
  imageUrl: string,
  collections: CollectionForSuggestion[],
  storageKey: string | null,
): Promise<PhotoAnalysisResult | null> {
  const { provider, reason } = await getActiveProvider();
  if (!provider) {
    logger.info({ reason }, "Skipping AI photo analysis");
    return null;
  }

  const allowedIds = collections.map((c) => c.id);
  const collectionsBlock = collections
    .map(
      (c) =>
        `- id=${c.id} | "${c.title}"${c.description ? ` — ${c.description}` : ""}`,
    )
    .join("\n");

  const systemPrompt =
    "You are a photo describer for a team photo album. Look at the photo and (1) write one short, plain-English sentence (max 25 words) describing what is in it; (2) from the user's existing collections, pick up to 3 that this photo would naturally belong in (only clear thematic matches, otherwise empty; never invent collection ids); and (3) suggest 3-5 short, lowercase, single-or-two-word tags describing the photo's subject, setting, mood, or activity (no '#', no punctuation).";

  const userText = collections.length
    ? `The user has these existing collections:\n${collectionsBlock}\n\nDescribe the photo, pick up to 3 collection ids from the list above that fit it, and suggest 3-5 short tags.`
    : "The user has no collections yet. Describe the photo, return an empty list of suggested collection ids, and suggest 3-5 short tags.";

  const image = await resolveImageForAI(imageUrl, storageKey);

  const result = await provider.analyze({
    imageDataUrl: image.dataUrl,
    contentType: image.contentType,
    systemPrompt,
    userText,
  });
  if (!result) return null;

  const suggestedCollectionIds = Array.from(
    new Set(
      result.suggestedCollectionIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && allowedIds.includes(id)),
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

  return {
    description: result.description,
    suggestedCollectionIds,
    suggestedTags,
  };
}
