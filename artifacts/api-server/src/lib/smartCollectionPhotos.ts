import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db, photoCollectionsTable, photoEmbeddingsTable, photosTable } from "@workspace/db";
import { embedText } from "./aiEmbedding";

export interface SmartCollectionResult {
  // "members": ranked by similarity to the average of the collection's own
  // photos. "term": the collection has no embedded members, so we fall back to
  // ranking by the collection's smartQuery/title.
  mode: "members" | "term";
  ids: number[];
}

/**
 * Resolve the ranked photo ids for a smart collection.
 *
 * The collection's *own images* drive it: average the embeddings of its member
 * photos into a centroid and rank every non-member photo by cosine distance to
 * it ("more like these"). When the collection has no embedded members, fall
 * back to embedding its smartQuery (or title) — the #47 behaviour — so a fresh
 * collection still shows something.
 */
export async function resolveSmartCollectionPhotoIds(
  collection: { id: number; title: string; smartQuery: string | null },
  topK: number,
): Promise<SmartCollectionResult> {
  const memberRows = await db
    .select({ photoId: photoCollectionsTable.photoId })
    .from(photoCollectionsTable)
    .where(eq(photoCollectionsTable.collectionId, collection.id));
  const memberIds = memberRows.map((r) => r.photoId);

  const memberEmbeddings = memberIds.length
    ? await db
        .select({ embedding: photoEmbeddingsTable.embedding })
        .from(photoEmbeddingsTable)
        .where(inArray(photoEmbeddingsTable.photoId, memberIds))
    : [];

  let queryVec: number[] | null;
  let mode: "members" | "term";

  if (memberEmbeddings.length > 0) {
    mode = "members";
    // Centroid = component-wise average of the member embeddings. Cosine
    // distance (<=>) ignores magnitude, so the raw average captures the
    // "average concept" direction of the collection.
    const dim = memberEmbeddings[0].embedding.length;
    const centroid = new Array<number>(dim).fill(0);
    for (const { embedding } of memberEmbeddings) {
      for (let i = 0; i < dim; i++) centroid[i] += embedding[i];
    }
    for (let i = 0; i < dim; i++) centroid[i] /= memberEmbeddings.length;
    queryVec = centroid;
  } else {
    mode = "term";
    const term = (collection.smartQuery ?? collection.title).trim();
    queryVec = term ? await embedText(term) : null;
  }

  if (!queryVec) return { mode, ids: [] };

  const vecLiteral = `[${queryVec.join(",")}]`;
  const rows = await db
    .select({ id: photoEmbeddingsTable.photoId })
    .from(photoEmbeddingsTable)
    .innerJoin(photosTable, eq(photosTable.id, photoEmbeddingsTable.photoId))
    .where(
      and(
        eq(photosTable.isHidden, false),
        // Exclude the seed photos — they're already in the collection.
        memberIds.length ? notInArray(photoEmbeddingsTable.photoId, memberIds) : undefined,
      ),
    )
    .orderBy(sql`${photoEmbeddingsTable.embedding} <=> ${vecLiteral}::vector`)
    .limit(topK);

  return { mode, ids: rows.map((r) => r.id) };
}
