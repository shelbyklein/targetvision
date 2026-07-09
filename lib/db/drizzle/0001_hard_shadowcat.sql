ALTER TABLE "photos" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE INDEX "photos_content_hash_idx" ON "photos" USING btree ("content_hash");