CREATE TABLE "organization_members" (
	"organization_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "photo_embeddings" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "ai_backfill_runs" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "bulk_upload_batches" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "attribution_tags" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "near_duplicate_pairs" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_embeddings" ADD CONSTRAINT "photo_embeddings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_backfill_runs" ADD CONSTRAINT "ai_backfill_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_upload_batches" ADD CONSTRAINT "bulk_upload_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_tags" ADD CONSTRAINT "attribution_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_duplicate_pairs" ADD CONSTRAINT "near_duplicate_pairs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ── Data migration (issue #113, Phase 1): fold the existing single-tenant data
-- into one default organization and enroll every existing user in it. The
-- instance admin (users.role = 'admin') becomes the org owner; everyone else a
-- member. Tenant rows are backfilled to this org; the columns stay nullable
-- until Phase 2 wires org context on insert and flips them NOT NULL.
INSERT INTO "organizations" ("name", "slug") VALUES ('USA Archery', 'usa-archery') ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
SELECT o."id", u."id", CASE WHEN u."role" = 'admin' THEN 'owner' ELSE 'member' END
FROM "organizations" o CROSS JOIN "users" u
WHERE o."slug" = 'usa-archery'
ON CONFLICT ("organization_id", "user_id") DO NOTHING;--> statement-breakpoint
UPDATE "albums"              SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "photos"             SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "photo_embeddings"   SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "collections"        SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "projects"           SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "tags"               SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "attribution_tags"   SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "bulk_upload_batches" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "ai_backfill_runs"   SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "near_duplicate_pairs" SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;--> statement-breakpoint
UPDATE "assets"             SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'usa-archery') WHERE "organization_id" IS NULL;