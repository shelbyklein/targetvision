CREATE TABLE "organization_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"active_provider" text DEFAULT 'openai' NOT NULL,
	"ai_auto_backfill_enabled" boolean DEFAULT false NOT NULL,
	"ai_auto_backfill_batch_size" integer DEFAULT 10 NOT NULL,
	"openai_key_ciphertext" text,
	"openai_key_iv" text,
	"openai_key_tag" text,
	"openai_key_preview" text,
	"openai_model" text,
	"anthropic_key_ciphertext" text,
	"anthropic_key_iv" text,
	"anthropic_key_tag" text,
	"anthropic_key_preview" text,
	"anthropic_model" text,
	"gemini_key_ciphertext" text,
	"gemini_key_iv" text,
	"gemini_key_tag" text,
	"gemini_key_preview" text,
	"gemini_model" text,
	"embedding_enabled" boolean DEFAULT false NOT NULL,
	"embedding_model" text,
	"image_optimization_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Data migration (issue #113, Phase 3): give every existing org a settings row
-- seeded from the current instance-wide app_settings singleton, so the AI
-- provider keys/models/toggles carry over to the default org. (When app_settings
-- has no row yet, no rows are seeded and loadOrgSettings lazily creates defaults.)
INSERT INTO "organization_settings" (
  "organization_id", "ai_enabled", "active_provider", "ai_auto_backfill_enabled", "ai_auto_backfill_batch_size",
  "openai_key_ciphertext", "openai_key_iv", "openai_key_tag", "openai_key_preview", "openai_model",
  "anthropic_key_ciphertext", "anthropic_key_iv", "anthropic_key_tag", "anthropic_key_preview", "anthropic_model",
  "gemini_key_ciphertext", "gemini_key_iv", "gemini_key_tag", "gemini_key_preview", "gemini_model",
  "embedding_enabled", "embedding_model", "image_optimization_enabled"
)
SELECT o."id", s."ai_enabled", s."active_provider", s."ai_auto_backfill_enabled", s."ai_auto_backfill_batch_size",
  s."openai_key_ciphertext", s."openai_key_iv", s."openai_key_tag", s."openai_key_preview", s."openai_model",
  s."anthropic_key_ciphertext", s."anthropic_key_iv", s."anthropic_key_tag", s."anthropic_key_preview", s."anthropic_model",
  s."gemini_key_ciphertext", s."gemini_key_iv", s."gemini_key_tag", s."gemini_key_preview", s."gemini_model",
  s."embedding_enabled", s."embedding_model", s."image_optimization_enabled"
FROM "organizations" o CROSS JOIN "app_settings" s WHERE s."id" = 1
ON CONFLICT ("organization_id") DO NOTHING;