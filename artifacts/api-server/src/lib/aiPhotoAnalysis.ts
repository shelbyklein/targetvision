import { getOpenAI } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const storageService = new ObjectStorageService();

async function resolveImageUrlForAI(imageUrl: string, storageKey: string | null): Promise<string> {
  if (storageKey && storageKey.startsWith("/objects/")) {
    try {
      const file = await storageService.getObjectEntityFile(storageKey);
      const [metadata] = await file.getMetadata();
      const [buffer] = await file.download();
      const contentType = (metadata.contentType as string) || "image/jpeg";
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (err) {
      logger.warn({ err, storageKey }, "Could not fetch private object for AI analysis");
    }
  }
  return imageUrl;
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
  try {
    const resolvedUrl = await resolveImageUrlForAI(imageUrl, storageKey);
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

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: resolvedUrl } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "photo_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              description: { type: "string" },
              suggestedCollectionIds: {
                type: "array",
                items: { type: "integer" },
                maxItems: 3,
              },
            },
            required: ["description", "suggestedCollectionIds"],
          },
        },
      },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PhotoAnalysisResult;
    const description = String(parsed.description ?? "").trim();
    const suggestedCollectionIds = Array.isArray(parsed.suggestedCollectionIds)
      ? Array.from(
          new Set(
            parsed.suggestedCollectionIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && allowedIds.includes(id)),
          ),
        ).slice(0, 3)
      : [];

    return { description, suggestedCollectionIds };
  } catch (err) {
    logger.error({ err }, "AI photo analysis failed");
    return null;
  }
}
