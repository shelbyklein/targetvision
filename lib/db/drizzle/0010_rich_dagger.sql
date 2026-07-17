CREATE TABLE "attribution_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribution_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "photo_attribution_tags" (
	"photo_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "photo_attribution_tags_photo_id_tag_id_pk" PRIMARY KEY("photo_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "photo_attribution_tags" ADD CONSTRAINT "photo_attribution_tags_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_attribution_tags" ADD CONSTRAINT "photo_attribution_tags_tag_id_attribution_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."attribution_tags"("id") ON DELETE cascade ON UPDATE no action;