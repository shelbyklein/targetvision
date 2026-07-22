import { pgTable, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";
import { organizationsTable } from "./organizations";

// Precomputed near-duplicate matches: every pair of photos whose perceptual
// (dHash) Hamming distance is within the max sensitivity (10 bits). Stored so
// the admin page reads pairs instead of re-running the O(n²) scan on every
// visit. Convention: photoA < photoB. Maintained incrementally when a photo's
// perceptual hash is computed, and cascade-deleted when a photo is removed.
export const nearDuplicatePairsTable = pgTable("near_duplicate_pairs", {
  // Tenant owner (issue #113) — near-duplicate detection is per-org. Nullable in
  // Phase 1 (backfilled, both photos share one org), NOT NULL in P2.
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  photoA: integer("photo_a").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
  photoB: integer("photo_b").notNull().references(() => photosTable.id, { onDelete: "cascade" }),
  distance: integer("distance").notNull(),
}, (table) => [
  primaryKey({ columns: [table.photoA, table.photoB] }),
  index("near_dup_pairs_photo_b_idx").on(table.photoB),
  index("near_dup_pairs_distance_idx").on(table.distance),
]);

export type NearDuplicatePair = typeof nearDuplicatePairsTable.$inferSelect;
