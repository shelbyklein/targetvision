import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const aiBackfillRunsTable = pgTable("ai_backfill_runs", {
  id: serial("id").primaryKey(),
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
