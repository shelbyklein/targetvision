import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

// Per-organization AI / embedding / image settings (issue #113, Phase 3). This
// is app_settings split per tenant: everything except the instance-level
// registration toggle moves here, so each org brings its own AI provider keys,
// models, embedding config, and image-optimization preference. One row per org
// (organization_id unique). Instance-level config stays in app_settings.
export const organizationSettingsTable = pgTable("organization_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .unique()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),

  aiEnabled: boolean("ai_enabled").notNull().default(true),
  activeProvider: text("active_provider").notNull().default("openai"),

  aiAutoBackfillEnabled: boolean("ai_auto_backfill_enabled").notNull().default(false),
  aiAutoBackfillBatchSize: integer("ai_auto_backfill_batch_size").notNull().default(10),

  openaiKeyCiphertext: text("openai_key_ciphertext"),
  openaiKeyIv: text("openai_key_iv"),
  openaiKeyTag: text("openai_key_tag"),
  openaiKeyPreview: text("openai_key_preview"),
  openaiModel: text("openai_model"),

  anthropicKeyCiphertext: text("anthropic_key_ciphertext"),
  anthropicKeyIv: text("anthropic_key_iv"),
  anthropicKeyTag: text("anthropic_key_tag"),
  anthropicKeyPreview: text("anthropic_key_preview"),
  anthropicModel: text("anthropic_model"),

  geminiKeyCiphertext: text("gemini_key_ciphertext"),
  geminiKeyIv: text("gemini_key_iv"),
  geminiKeyTag: text("gemini_key_tag"),
  geminiKeyPreview: text("gemini_key_preview"),
  geminiModel: text("gemini_model"),

  // Image embeddings via Google Vertex AI. Auth/project come from env (ADC), so
  // only the on/off toggle and optional model override live per org.
  embeddingEnabled: boolean("embedding_enabled").notNull().default(false),
  embeddingModel: text("embedding_model"),

  // Re-encode newly-uploaded originals to WebP on import. On by default.
  imageOptimizationEnabled: boolean("image_optimization_enabled").notNull().default(true),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationSettings = typeof organizationSettingsTable.$inferSelect;
