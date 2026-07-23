import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db, organizationsTable, organizationSubscriptionsTable } from "@workspace/db";
import { logger } from "../logger";
import { stripe } from "../stripe";
import { syncFromSubscription } from "./webhook";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

let isRunning = false;

// Webhooks are at-least-once but not guaranteed — a missed or dropped event
// leaves organizations.plan / the subscription row stale. This periodically
// re-reads each org's live Stripe subscription and re-syncs any drift (#118).
// Free orgs and manually-assigned Enterprise orgs have no Stripe subscription to
// reconcile, so they're skipped by the query.
async function tick(): Promise<void> {
  if (!stripe || isRunning) return;
  isRunning = true;
  try {
    const rows = await db
      .select({ org: organizationsTable, subscriptionId: organizationSubscriptionsTable.stripeSubscriptionId })
      .from(organizationSubscriptionsTable)
      .innerJoin(organizationsTable, eq(organizationsTable.id, organizationSubscriptionsTable.organizationId))
      .where(
        and(
          isNotNull(organizationSubscriptionsTable.stripeSubscriptionId),
          ne(organizationsTable.plan, "enterprise"),
        ),
      );

    for (const { org, subscriptionId } of rows) {
      if (!subscriptionId) continue;
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await syncFromSubscription(org, sub);
      } catch (err) {
        logger.warn({ err, orgId: org.id, subscriptionId }, "Billing reconcile: failed to sync one org");
      }
    }
  } catch (err) {
    logger.error({ err }, "Billing reconcile: unexpected error");
  } finally {
    isRunning = false;
  }
}

// No-op unless Stripe is configured, so the app boots without keys.
export function startBillingReconcileScheduler(): void {
  if (!stripe) return;
  setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
}
