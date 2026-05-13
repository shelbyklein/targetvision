import { pgTable, serial, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { collectionsTable } from "./collections";

export const tagsTable = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const collectionTagsTable = pgTable("collection_tags", {
  collectionId: integer("collection_id").notNull().references(() => collectionsTable.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tagsTable.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.collectionId, table.tagId] })]);

export type Tag = typeof tagsTable.$inferSelect;
export type CollectionTag = typeof collectionTagsTable.$inferSelect;
