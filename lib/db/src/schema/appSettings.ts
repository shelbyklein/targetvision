import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const APP_SETTINGS_SINGLETON_ID = 1;

export const appSettingsTable = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
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

  // Image-embedding provider (Cohere) — separate from the vision providers
  // above because embeddings use a different provider/model. Key encrypted with
  // the same AES-GCM scheme (secretCrypto).
  embeddingEnabled: boolean("embedding_enabled").notNull().default(false),
  embeddingModel: text("embedding_model"),
  embeddingKeyCiphertext: text("embedding_key_ciphertext"),
  embeddingKeyIv: text("embedding_key_iv"),
  embeddingKeyTag: text("embedding_key_tag"),
  embeddingKeyPreview: text("embedding_key_preview"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
