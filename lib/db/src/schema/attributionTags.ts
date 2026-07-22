import { pgTable, serial, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";
import { organizationsTable } from "./organizations";

// User-defined attribution / usage-rights tags: which kinds of use a photo is
// cleared for (e.g. "USA Archery", "World Archery", "Social"). Distinct from
// the descriptive collection tags in tags.ts — these carry rights semantics.
export const attributionTagsTable = pgTable("attribution_tags", {
  id: serial("id").primaryKey(),
  // Tenant owner (issue #113). Nullable in Phase 1 (backfilled), NOT NULL in P2.
  // The global-unique `name` becomes per-org unique in Phase 2.
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const photoAttributionTagsTable = pgTable("photo_attribution_tags", {
  photoId: integer("photo_id").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => attributionTagsTable.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.photoId, table.tagId] }),
]);

export type AttributionTag = typeof attributionTagsTable.$inferSelect;
export type PhotoAttributionTag = typeof photoAttributionTagsTable.$inferSelect;
