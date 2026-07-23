import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const albumsTable = pgTable("albums", {
  id: serial("id").primaryKey(),
  // Multi-tenant owner (issue #113). Nullable in Phase 1 (backfilled to the
  // default org); the API sets it on insert and it flips NOT NULL in Phase 2.
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: text("event_date"),
  // Optional organizational label grouping albums on the Albums page — e.g.
  // "2026" for a season (#149, light first cut). Free text; folders exist
  // implicitly as the distinct values; null = ungrouped.
  folder: text("folder"),
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
