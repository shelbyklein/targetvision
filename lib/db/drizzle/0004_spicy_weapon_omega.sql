ALTER TABLE "photos" ADD COLUMN "perceptual_hash" text;--> statement-breakpoint
CREATE INDEX "photos_perceptual_hash_idx" ON "photos" USING btree ("perceptual_hash");