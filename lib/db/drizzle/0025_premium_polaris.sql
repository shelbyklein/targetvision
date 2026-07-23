CREATE TABLE "near_duplicate_ignores" (
	"organization_id" integer NOT NULL,
	"photo_a" integer NOT NULL,
	"photo_b" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "near_duplicate_ignores_photo_a_photo_b_pk" PRIMARY KEY("photo_a","photo_b")
);
--> statement-breakpoint
ALTER TABLE "near_duplicate_ignores" ADD CONSTRAINT "near_duplicate_ignores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_duplicate_ignores" ADD CONSTRAINT "near_duplicate_ignores_photo_a_photos_id_fk" FOREIGN KEY ("photo_a") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_duplicate_ignores" ADD CONSTRAINT "near_duplicate_ignores_photo_b_photos_id_fk" FOREIGN KEY ("photo_b") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "near_dup_ignores_org_idx" ON "near_duplicate_ignores" USING btree ("organization_id");