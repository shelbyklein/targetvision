import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { photosTable } from "./photos";

export const aiAnalysisStatusEnum = pgEnum("ai_analysis_status", [
  "success",
  "skipped",
  "failed",
]);

export const aiAnalysisEventsTable = pgTable("ai_analysis_events", {
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
});

export type AiAnalysisEvent = typeof aiAnalysisEventsTable.$inferSelect;
