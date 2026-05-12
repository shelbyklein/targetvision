import { pgTable, text, serial, timestamp, integer, primaryKey, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { albumsTable } from "./albums";
import { collectionsTable } from "./collections";

export const photosTable = pgTable("photos", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id").notNull().references(() => albumsTable.id, { onDelete: "cascade" }),
  uploaderId: integer("uploader_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  storageKey: text("storage_key"),
  url: text("url").notNull(),
  caption: text("caption"),
  aiDescription: text("ai_description"),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const photoTagSuggestionsTable = pgTable(
  "photo_tag_suggestions",
  {
    photoId: integer("photo_id").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
    tagName: text("tag_name").notNull(),
    status: photoSuggestionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.photoId, table.tagName] })],
);

export const insertPhotoSchema = createInsertSchema(photosTable).omit({ id: true, createdAt: true });
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Photo = typeof photosTable.$inferSelect;
export type PhotoCollectionSuggestion = typeof photoCollectionSuggestionsTable.$inferSelect;
export type PhotoTagSuggestion = typeof photoTagSuggestionsTable.$inferSelect;
