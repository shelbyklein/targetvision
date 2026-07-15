import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  db,
  photoCollectionsTable,
  collectionNegativePhotosTable,
  photoEmbeddingsTable,
  photosTable,
} from "@workspace/db";
import { embedText } from "./aiEmbedding";

// How hard the negative examples push the query vector away from their concept.
const NEGATIVE_LAMBDA = 0.75;

export interface SmartCollectionResult {
  // "members": ranked by similarity to the average of the collection's own
  // photos. "term": the collection has no embedded members, so we fall back to
  // ranking by the collection's smartQuery/title.
  mode: "members" | "term";
  ids: number[];
}

function centroid(embeddings: { embedding: number[] }[]): number[] {
  const dim = embeddings[0].embedding.length;
  const c = new Array<number>(dim).fill(0);
  for (const { embedding } of embeddings) {
    for (let i = 0; i < dim; i++) c[i] += embedding[i];
  }
  for (let i = 0; i < dim; i++) c[i] /= embeddings.length;
  return c;
}

function normalize(v: number[]): number[] {
  const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / m);
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
  const [memberRows, negativeRows] = await Promise.all([
    db
      .select({ photoId: photoCollectionsTable.photoId })
      .from(photoCollectionsTable)
      .where(eq(photoCollectionsTable.collectionId, collection.id)),
    db
      .select({ photoId: collectionNegativePhotosTable.photoId })
      .from(collectionNegativePhotosTable)
      .where(eq(collectionNegativePhotosTable.collectionId, collection.id)),
  ]);
  const memberIds = memberRows.map((r) => r.photoId);
  const negativeIds = negativeRows.map((r) => r.photoId);

  const [memberEmbeddings, negativeEmbeddings] = await Promise.all([
    memberIds.length
      ? db.select({ embedding: photoEmbeddingsTable.embedding }).from(photoEmbeddingsTable).where(inArray(photoEmbeddingsTable.photoId, memberIds))
      : Promise.resolve([]),
    negativeIds.length
      ? db.select({ embedding: photoEmbeddingsTable.embedding }).from(photoEmbeddingsTable).where(inArray(photoEmbeddingsTable.photoId, negativeIds))
      : Promise.resolve([]),
  ]);

  // Positive base vector: the member centroid, else the collection's term.
  let posVec: number[] | null;
  let mode: "members" | "term";
  if (memberEmbeddings.length > 0) {
    mode = "members";
    posVec = centroid(memberEmbeddings);
  } else {
    mode = "term";
    const term = (collection.smartQuery ?? collection.title).trim();
    posVec = term ? await embedText(term) : null;
  }
  if (!posVec) return { mode, ids: [] };

  // Steer away from the negative examples: query = norm(pos) - λ·norm(negCentroid).
  let queryVec = posVec;
  if (negativeEmbeddings.length > 0) {
    const p = normalize(posVec);
    const n = normalize(centroid(negativeEmbeddings));
    queryVec = p.map((x, i) => x - NEGATIVE_LAMBDA * n[i]);
  }

  const excludeIds = [...memberIds, ...negativeIds];
  const vecLiteral = `[${queryVec.join(",")}]`;
  const rows = await db
    .select({ id: photoEmbeddingsTable.photoId })
    .from(photoEmbeddingsTable)
    .innerJoin(photosTable, eq(photosTable.id, photoEmbeddingsTable.photoId))
    .where(
      and(
        eq(photosTable.isHidden, false),
        // Exclude the seed members and the negative examples from suggestions.
        excludeIds.length ? notInArray(photoEmbeddingsTable.photoId, excludeIds) : undefined,
      ),
    )
    .orderBy(sql`${photoEmbeddingsTable.embedding} <=> ${vecLiteral}::vector`)
    .limit(topK);

  return { mode, ids: rows.map((r) => r.id) };
}
