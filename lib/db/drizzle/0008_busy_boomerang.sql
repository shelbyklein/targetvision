CREATE TABLE "collection_negative_photos" (
	"collection_id" integer NOT NULL,
	"photo_id" integer NOT NULL,
	CONSTRAINT "collection_negative_photos_collection_id_photo_id_pk" PRIMARY KEY("collection_id","photo_id")
);
--> statement-breakpoint
ALTER TABLE "collection_negative_photos" ADD CONSTRAINT "collection_negative_photos_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_negative_photos" ADD CONSTRAINT "collection_negative_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;