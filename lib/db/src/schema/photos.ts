import { pgTable, text, serial, timestamp, integer, primaryKey, pgEnum, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { albumsTable } from "./albums";
import { collectionsTable } from "./collections";

export const photosTable = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    albumId: integer("album_id").notNull().references(() => albumsTable.id, { onDelete: "cascade" }),
    uploaderId: integer("uploader_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    storageKey: text("storage_key"),
    thumbnailKey: text("thumbnail_key"),
    url: text("url").notNull(),
    filename: text("filename"),
    filesize: integer("filesize"),
    aiDescription: text("ai_description"),
    isHidden: boolean("is_hidden").notNull().default(false),
    thumbnailGenerating: boolean("thumbnail_generating").notNull().default(false),
    // SHA-256 hex digest of the original image bytes. Used to detect exact
    // (byte-identical) duplicate photos. Nullable: populated on upload and via
    // a background backfill for rows that predate this column.
    contentHash: text("content_hash"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Album photo listing: WHERE album_id = ? ORDER BY created_at DESC.
    index("photos_album_created_idx").on(table.albumId, table.createdAt.desc()),
    // Global photo listing / recent / dashboards: ORDER BY created_at DESC.
    index("photos_created_idx").on(table.createdAt.desc()),
    // uploaderId and takenAt filters (search / date-range).
    index("photos_uploader_idx").on(table.uploaderId),
    index("photos_taken_at_idx").on(table.takenAt),
    // Duplicate detection groups photos by their content hash.
    index("photos_content_hash_idx").on(table.contentHash),
  ],
);

export const photoSuggestionStatusEnum = pgEnum("photo_suggestion_status", [
  "pending",
  "accepted",
  "dismissed",
]);

export const photoCollectionSuggestionsTable = pgTable(
  "photo_collection_suggestions",
  {
    photoId: integer("photo_id").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
    status: photoSuggestionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.photoId, table.collectionId] })],
);

export const photoNewCollectionSuggestionsTable = pgTable(
  "photo_new_collection_suggestions",
  {
    id: serial("id").primaryKey(),
    photoId: integer("photo_id").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
    suggestedName: text("suggested_name").notNull(),
    status: photoSuggestionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const insertPhotoSchema = createInsertSchema(photosTable).omit({ id: true, createdAt: true });
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photosTable.$inferSelect;
export type PhotoCollectionSuggestion = typeof photoCollectionSuggestionsTable.$inferSelect;
export type PhotoNewCollectionSuggestion = typeof photoNewCollectionSuggestionsTable.$inferSelect;
