import { pgTable, pgEnum, text, serial, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { photosTable } from "./photos";

// "People" are collections with kind='person': same membership, smart-ranking,
// suggestion, and negative-example machinery, listed on their own pages. List
// queries filter by kind so the two types never mix in the UI.
export const collectionKindEnum = pgEnum("collection_kind", ["collection", "person"]);

export const collectionsTable = pgTable("collections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  createdById: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  coverPhotoId: integer("cover_photo_id").references(() => photosTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Optional semantic-search term for this collection. When viewing the
  // collection as a "smart collection", photos are ranked by embedding
  // similarity to this term (falls back to the title when null).
  smartQuery: text("smart_query"),
  // Manual card position (drag-to-reorder). Shared by the Collections and
  // Smart Collections pages — both render rows from this table. Null = never
  // placed; lists sort sort_order ASC nulls-last, then created_at desc.
  sortOrder: integer("sort_order"),
  kind: collectionKindEnum("kind").notNull().default("collection"),
});

export const photoCollectionsTable = pgTable("photo_collections", {
  collectionId: integer("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
  photoId: integer("photo_id").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.collectionId, table.photoId] }),
]);

// Photos explicitly marked "not applicable" to a collection. Used as negative
// examples when ranking a smart collection: their average embedding is
// subtracted from the query, and they're excluded from suggestions. Mutually
// exclusive with photo_collections (a photo is a positive, a negative, or
// neither).
export const collectionNegativePhotosTable = pgTable("collection_negative_photos", {
  collectionId: integer("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
  photoId: integer("photo_id").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.collectionId, table.photoId] }),
]);

export type Collection = typeof collectionsTable.$inferSelect;
export type PhotoCollection = typeof photoCollectionsTable.$inferSelect;
export type CollectionNegativePhoto = typeof collectionNegativePhotosTable.$inferSelect;
