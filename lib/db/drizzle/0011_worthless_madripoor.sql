CREATE TABLE "near_duplicate_pairs" (
	"photo_a" integer NOT NULL,
	"photo_b" integer NOT NULL,
	"distance" integer NOT NULL,
	CONSTRAINT "near_duplicate_pairs_photo_a_photo_b_pk" PRIMARY KEY("photo_a","photo_b")
);
--> statement-breakpoint
ALTER TABLE "near_duplicate_pairs" ADD CONSTRAINT "near_duplicate_pairs_photo_a_photos_id_fk" FOREIGN KEY ("photo_a") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_duplicate_pairs" ADD CONSTRAINT "near_duplicate_pairs_photo_b_photos_id_fk" FOREIGN KEY ("photo_b") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "near_dup_pairs_photo_b_idx" ON "near_duplicate_pairs" USING btree ("photo_b");--> statement-breakpoint
CREATE INDEX "near_dup_pairs_distance_idx" ON "near_duplicate_pairs" USING btree ("distance");