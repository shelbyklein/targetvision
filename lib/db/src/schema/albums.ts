import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const albumsTable = pgTable("albums", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: text("event_date"),
  coverPhotoId: integer("cover_photo_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Manual card position on the Albums page (drag-to-reorder). Null = never
  // placed; lists sort sort_order ASC (Postgres puts nulls last), then fall
  // back to the previous default order, so new albums append at the end.
  sortOrder: integer("sort_order"),
});

export const insertAlbumSchema = createInsertSchema(albumsTable).omit({ id: true, createdAt: true });
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type Album = typeof albumsTable.$inferSelect;
