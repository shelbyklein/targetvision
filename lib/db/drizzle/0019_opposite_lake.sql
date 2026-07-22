-- Defensive backfill (issue #113, Phase 2c): rows written by background jobs
-- between the Phase 2b deploy and this one (embeddings, near-dup pairs) may have
-- a null organization_id — derive it from the owning photo before enforcing NOT
-- NULL. On a clean DB these UPDATEs touch zero rows.
UPDATE "photos" ph SET "organization_id" = a."organization_id" FROM "albums" a WHERE ph."album_id" = a."id" AND ph."organization_id" IS NULL;--> statement-breakpoint
UPDATE "photo_embeddings" pe SET "organization_id" = p."organization_id" FROM "photos" p WHERE pe."photo_id" = p."id" AND pe."organization_id" IS NULL;--> statement-breakpoint
UPDATE "near_duplicate_pairs" ndp SET "organization_id" = p."organization_id" FROM "photos" p WHERE ndp."photo_a" = p."id" AND ndp."organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "albums" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collections" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_embeddings" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bulk_upload_batches" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attribution_tags" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "near_duplicate_pairs" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "organization_id" SET NOT NULL;