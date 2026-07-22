import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const bulkUploadBatchesTable = pgTable("bulk_upload_batches", {
  id: serial("id").primaryKey(),
  // Tenant owner (issue #113). Nullable in Phase 1 (backfilled), NOT NULL in P2.
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  groupNames: text("group_names").array().notNull().default([]),
  albumIds: integer("album_ids").array().notNull().default([]),
  totalUploaded: integer("total_uploaded").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BulkUploadBatch = typeof bulkUploadBatchesTable.$inferSelect;
