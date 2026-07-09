import { pgTable, serial, integer, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";

export const aiAnalysisStatusEnum = pgEnum("ai_analysis_status", [
  "success",
  "skipped",
  "failed",
]);

export const aiAnalysisEventsTable = pgTable(
  "ai_analysis_events",
  {
    id: serial("id").primaryKey(),
    photoId: integer("photo_id").references(() => photosTable.id, {
      onDelete: "set null",
    }),
    provider: text("provider"),
    status: aiAnalysisStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Latest-event-per-photo lookups (aiStatus filter, latestAiStatus in responses):
  // WHERE photo_id = ? ORDER BY created_at DESC.
  (table) => [index("ai_events_photo_created_idx").on(table.photoId, table.createdAt.desc())],
);

export type AiAnalysisEvent = typeof aiAnalysisEventsTable.$inferSelect;
