import { pgTable, text, serial, timestamp, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// An organization is the top-level multi-tenant container (issue #113). Each org
// owns an independent set of albums/photos/people/etc.; tenant tables carry an
// `organization_id` and every scoped query filters on it. Phase 1 introduces the
// tables and columns (nullable, backfilled into a default org); the API scoping
// sweep and NOT NULL enforcement land in Phase 2.
export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // URL/handle-safe unique identifier (e.g. "usa-archery").
  slug: text("slug").notNull().unique(),
  // Optional free-text description shown on the org settings page.
  description: text("description"),
  // Subscription tier (issue #118): "free" | "pro" | "enterprise". Kept on the
  // org row (loaded on every request via req.org) so feature-gating reads it
  // with zero extra query; volatile Stripe state lives in
  // organization_subscriptions. text (not enum) so future tiers / admin
  // overrides need no enum migration — validated against PLAN_IDS in app code.
  plan: text("plan").notNull().default("free"),
  // Org logo (issue #121): an /objects/ storage key from the upload flow, or
  // null for the default building mark. Served via /api/storage (member-gated).
  logoKey: text("logo_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Membership + per-org role. `owner` is the org's superuser (created it / holds
// billing), `admin` manages members and settings, `member` uses the library.
// Distinct from the instance-level `users.role` superadmin, which governs
// instance concerns (registration, org list) rather than anything inside an org.
export const organizationMembersTable = pgTable(
  "organization_members",
  {
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // "owner" | "admin" | "member"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    // "List the orgs I belong to" filters by user.
    index("organization_members_user_idx").on(table.userId),
  ],
);

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
