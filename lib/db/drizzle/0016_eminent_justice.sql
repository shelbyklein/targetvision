CREATE TYPE "public"."asset_kind" AS ENUM('brand', 'reference');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"name" text NOT NULL,
	"variant" text,
	"notes" text,
	"project_id" integer,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"filename" text,
	"file_size" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_project_idx" ON "assets" USING btree ("project_id");