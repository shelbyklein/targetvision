CREATE TYPE "public"."photo_suggestion_status" AS ENUM('pending', 'accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."ai_analysis_status" AS ENUM('success', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "albums" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" text,
	"cover_photo_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_collection_suggestions" (
	"photo_id" integer NOT NULL,
	"collection_id" integer NOT NULL,
	"status" "photo_suggestion_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_collection_suggestions_photo_id_collection_id_pk" PRIMARY KEY("photo_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "photo_new_collection_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_id" integer NOT NULL,
	"suggested_name" text NOT NULL,
	"status" "photo_suggestion_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"album_id" integer NOT NULL,
	"uploader_id" integer NOT NULL,
	"storage_key" text,
	"thumbnail_key" text,
	"url" text NOT NULL,
	"filename" text,
	"filesize" integer,
	"ai_description" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"thumbnail_generating" boolean DEFAULT false NOT NULL,
	"taken_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_tags" (
	"collection_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "collection_tags_collection_id_tag_id_pk" PRIMARY KEY("collection_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_photo_id_user_id_unique" UNIQUE("photo_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by" integer NOT NULL,
	"cover_photo_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ai_keywords" text
);
--> statement-breakpoint
CREATE TABLE "photo_collections" (
	"collection_id" integer NOT NULL,
	"photo_id" integer NOT NULL,
	CONSTRAINT "photo_collections_collection_id_photo_id_pk" PRIMARY KEY("collection_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"registration_enabled" boolean DEFAULT true NOT NULL,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_analysis_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"photo_id" integer,
	"provider" text,
	"status" "ai_analysis_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_backfill_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"requested_limit" integer,
	"processed" integer NOT NULL,
	"succeeded" integer NOT NULL,
	"skipped" integer NOT NULL,
	"failed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_upload_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"group_names" text[] DEFAULT '{}' NOT NULL,
	"album_ids" integer[] DEFAULT '{}' NOT NULL,
	"total_uploaded" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_collection_suggestions" ADD CONSTRAINT "photo_collection_suggestions_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_collection_suggestions" ADD CONSTRAINT "photo_collection_suggestions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_new_collection_suggestions" ADD CONSTRAINT "photo_new_collection_suggestions_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_collections" ADD CONSTRAINT "photo_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_collections" ADD CONSTRAINT "photo_collections_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analysis_events" ADD CONSTRAINT "ai_analysis_events_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_upload_batches" ADD CONSTRAINT "bulk_upload_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "photos_album_created_idx" ON "photos" USING btree ("album_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "photos_created_idx" ON "photos" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "photos_uploader_idx" ON "photos" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "photos_taken_at_idx" ON "photos" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "ai_events_photo_created_idx" ON "ai_analysis_events" USING btree ("photo_id","created_at" DESC NULLS LAST);