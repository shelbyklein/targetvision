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
    "You are a photo describer for a team photo album. Look at the photo and write one short, plain-English sentence (max 25 words) describing what is in it. Then, from the user's existing collections, pick up to 3 that this photo would naturally belong in. Only suggest a collection if it's a clear thematic match; return an empty list if nothing fits. Never invent collection ids.";

  const userText = collections.length
    ? `The user has these existing collections:\n${collectionsBlock}\n\nDescribe the photo and pick up to 3 collection ids from the list above that fit it.`
    : "The user has no collections yet. Describe the photo. Return an empty list of suggested collection ids.";

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

  return {
    description: result.description,
    suggestedCollectionIds,
  };
}
