CREATE TABLE "organization_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_subscriptions_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_subscriptions_stripe_customer_idx" ON "organization_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "org_subscriptions_stripe_subscription_idx" ON "organization_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint

-- issue #118: the existing USA Archery org predates billing and must never be
-- gated by the default 'free' cap — grant it the unlimited enterprise tier.
-- (No-op on a fresh DB that has no such org.)
UPDATE "organizations" SET "plan" = 'enterprise' WHERE "slug" = 'usa-archery';