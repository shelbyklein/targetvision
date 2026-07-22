import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

// Volatile Stripe subscription state for an org (issue #118), one row per org.
// The webhook is the source of truth: it writes this row AND syncs
// organizations.plan (the hot-path gating value). Billing screens read this;
// the upload gate only needs organizations.plan.
export const organizationSubscriptionsTable = pgTable(
  "organization_subscriptions",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .notNull()
      .unique()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // Stripe subscription status: active | trialing | past_due | canceled |
    // inactive (the default before any subscription exists).
    status: text("status").notNull().default("inactive"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The webhook resolves an org by its Stripe customer/subscription id.
    index("org_subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
    index("org_subscriptions_stripe_subscription_idx").on(table.stripeSubscriptionId),
  ],
);

export type OrganizationSubscription = typeof organizationSubscriptionsTable.$inferSelect;
