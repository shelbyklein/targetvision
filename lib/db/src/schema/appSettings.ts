import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const APP_SETTINGS_SINGLETON_ID = 1;

export const appSettingsTable = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  activeProvider: text("active_provider").notNull().default("openai"),

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

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
