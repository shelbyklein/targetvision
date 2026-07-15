import { pgTable, integer, text, timestamp, customType } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";

// Fixed by the embedding model. Google Vertex AI multimodalembedding@001 outputs
// 1408-dim vectors (image + text share this space). Changing the model to a
// different dimension requires a re-embed and a new migration (the pgvector
// column dimension is part of the column type).
export const EMBEDDING_DIMENSION = 1408;

// pgvector column type. drizzle-kit has no native `vector` type, so it's declared
// via customType. On the wire pgvector uses the text form "[1,2,3]"; we convert
// to/from number[] here so app code just works with arrays.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSION})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(",").map(Number);
  },
});

// One embedding per photo (photoId is the PK). The ANN index
// (CREATE INDEX ... USING hnsw) is added in the migration SQL — drizzle-kit can't
// express a pgvector index, so it isn't declared here.
export const photoEmbeddingsTable = pgTable("photo_embeddings", {
  photoId: integer("photo_id")
    .primaryKey()
    .references(() => photosTable.id, { onDelete: "cascade" }),
  embedding: vector("embedding").notNull(),
  // e.g. "vertex/multimodalembedding@001" — tracks which model produced the
  // vector, so a model change can be detected for re-embedding.
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PhotoEmbedding = typeof photoEmbeddingsTable.$inferSelect;
