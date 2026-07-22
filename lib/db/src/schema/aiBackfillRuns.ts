import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const aiBackfillRunsTable = pgTable("ai_backfill_runs", {
  id: serial("id").primaryKey(),
  // Tenant owner (issue #113) — backfill schedulers become per-org in Phase 3.
  // Nullable in Phase 1 (backfilled), NOT NULL in P2.
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull().default("manual"), // "manual" | "automatic"
  requestedLimit: integer("requested_limit"),
  processed: integer("processed").notNull(),
  succeeded: integer("succeeded").notNull(),
  skipped: integer("skipped").notNull(),
  failed: integer("failed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AiBackfillRun = typeof aiBackfillRunsTable.$inferSelect;
