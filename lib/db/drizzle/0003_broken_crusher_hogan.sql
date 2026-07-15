CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "photo_embeddings" (
	"photo_id" integer PRIMARY KEY NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "embedding_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "embedding_key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "embedding_key_iv" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "embedding_key_tag" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "embedding_key_preview" text;--> statement-breakpoint
ALTER TABLE "photo_embeddings" ADD CONSTRAINT "photo_embeddings_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_embeddings_embedding_hnsw_idx" ON "photo_embeddings" USING hnsw ("embedding" vector_cosine_ops);