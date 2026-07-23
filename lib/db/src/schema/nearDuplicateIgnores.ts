import { pgTable, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";
import { organizationsTable } from "./organizations";

// Pairs a user has dismissed as "not duplicates" in the near-duplicates cleanup
// (issue #124). Kept separate from near_duplicate_pairs because the pair index
// is deleted + rebuilt wholesale (rebuildNearDuplicatePairs) — ignores must
// survive that. Convention matches the pair table: photoA < photoB. Grouping
// excludes ignored pairs, so a fully-ignored group stops resurfacing.
export const nearDuplicateIgnoresTable = pgTable("near_duplicate_ignores", {
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  photoA: integer("photo_a").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
  photoB: integer("photo_b").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.photoA, table.photoB] }),
  index("near_dup_ignores_org_idx").on(table.organizationId),
]);

export type NearDuplicateIgnore = typeof nearDuplicateIgnoresTable.$inferSelect;
