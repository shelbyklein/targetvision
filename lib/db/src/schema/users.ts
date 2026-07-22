import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  authUserId: text("auth_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // The user's preferred sidebar nav order (array of nav hrefs). Null = default
  // order; unknown/new items render after the saved ones in default order.
  navOrder: text("nav_order").array(),
  // Sticky "current organization" (issue #113): the org this user last acted in,
  // used to resolve request org context when no X-Organization-Id header is sent.
  // Set null if that org is deleted. Nullable — a brand-new user has none yet.
  lastActiveOrgId: integer("last_active_org_id").references(() => organizationsTable.id, {
    onDelete: "set null",
  }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
