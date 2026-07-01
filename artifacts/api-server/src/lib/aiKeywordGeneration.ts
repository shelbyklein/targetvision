import { eq } from "drizzle-orm";
import { db, collectionsTable } from "@workspace/db";
import { getActiveProvider } from "./aiProviders";
import { logger } from "./logger";

const SYSTEM_PROMPT =
  "You are a keyword expansion engine for a sports photo album. Given a collection name and optional description, return a JSON object with a \"keywords\" array containing 8–15 related search terms, synonyms, and closely related concepts that would help match photos to this collection. Include variations, abbreviations, and sport-specific terminology. Only return the JSON object with no other text.";

export async function generateCollectionKeywords(
  collectionId: number,
  title: string,
  description: string | null,
): Promise<string[]> {
  const { provider } = await getActiveProvider();
  if (!provider) return [];

  const userText = `Collection name: "${title}"${description ? `\nDescription: ${description}` : ""}\n\nReturn: {"keywords": ["term1","term2",...]}`;

  try {
    const raw = await provider.generateText(SYSTEM_PROMPT, userText);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { keywords?: unknown };
    if (!Array.isArray(parsed.keywords)) return [];
    const keywords = (parsed.keywords as unknown[])
      .map((k) => String(k).trim().toLowerCase())
      .filter((k) => k.length > 1 && k.length <= 60)
      .slice(0, 20);

    if (keywords.length > 0) {
      await db
        .update(collectionsTable)
        .set({ aiKeywords: JSON.stringify(keywords) })
        .where(eq(collectionsTable.id, collectionId));
    }
    return keywords;
  } catch (err) {
    logger.error({ err, collectionId }, "Failed to generate collection keywords");
    return [];
  }
}
