import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

// Pending invitations to join an organization (issue #113, Phase 4c). An org
// owner/admin invites an email + role; when a user with that email signs in they
// are auto-enrolled and the invite is consumed. One pending invite per (org,
// email). Invited emails may sign up even when instance registration is off.
export const organizationInvitesTable = pgTable(
  "organization_invites",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // Stored lowercased for case-insensitive matching against the sign-in email.
    email: text("email").notNull(),
    role: text("role").notNull().default("member"), // "owner" | "admin" | "member"
    invitedById: integer("invited_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.organizationId, table.email)],
);

export type OrganizationInvite = typeof organizationInvitesTable.$inferSelect;
