-- issue #113 Phase 5: scope MCP gateway tokens to an org. Add the column
-- nullable, assign existing tokens to the default (lowest-id) org, then enforce
-- NOT NULL + FK. On a token-less DB the UPDATE touches nothing.
ALTER TABLE "mcp_tokens" ADD COLUMN "organization_id" integer;--> statement-breakpoint
UPDATE "mcp_tokens" SET "organization_id" = (SELECT min("id") FROM "organizations") WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
