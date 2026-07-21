CREATE TYPE "public"."collection_kind" AS ENUM('collection', 'person');--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "kind" "collection_kind" DEFAULT 'collection' NOT NULL;