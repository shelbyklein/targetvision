import type { RequestHandler } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, organizationsTable, organizationSubscriptionsTable, type Organization } from "@workspace/db";
import { logger } from "../logger";
import { stripe, STRIPE_WEBHOOK_SECRET } from "../stripe";
import { resolveOrgByStripeCustomer, resolveOrgByStripeSubscription } from "./subscriptions";

// current_period_end has moved between the Subscription object and its items
// across Stripe API versions — read it defensively so this survives version pins.
function periodEndOf(sub: Stripe.Subscription): Date | null {
  const onSub = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  const onItem = (sub.items?.data?.[0] as unknown as { current_period_end?: number | null } | undefined)
    ?.current_period_end;
  const epoch = onSub ?? onItem ?? null;
  return epoch ? new Date(epoch * 1000) : null;
}

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

// Write the org's subscription row from a Stripe.Subscription (absolute state, so
// re-delivering the same event is idempotent) and keep organizations.plan in
// sync — but never downgrade an admin-assigned enterprise org.
export async function syncFromSubscription(org: Organization, sub: Stripe.Subscription): Promise<void> {
  await db
    .update(organizationSubscriptionsTable)
    .set({
      status: sub.status,
      stripeCustomerId: customerIdOf(sub),
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: periodEndOf(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(organizationSubscriptionsTable.organizationId, org.id));

  if (org.plan === "enterprise") return; // manual grant — leave it alone

  // active / trialing / past_due keep Pro (dunning grace); anything terminal → free.
  const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  const plan = active ? "pro" : "free";
  if (plan !== org.plan) {
    await db.update(organizationsTable).set({ plan }).where(eq(organizationsTable.id, org.id));
  }
}

async function orgForSubscription(sub: Stripe.Subscription): Promise<Organization | null> {
  // Prefer the org id we stamped into subscription metadata; fall back to the
  // stored subscription id, then the customer id.
  const metaOrgId = Number(sub.metadata?.organizationId);
  if (Number.isInteger(metaOrgId)) {
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, metaOrgId));
    if (org) return org;
  }
  const bySub = await resolveOrgByStripeSubscription(sub.id);
  if (bySub) return bySub.org;
  const byCust = await resolveOrgByStripeCustomer(customerIdOf(sub));
  return byCust?.org ?? null;
}

export const billingWebhookHandler: RequestHandler = (req, res) => {
  void (async () => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      res.status(503).json({ error: "Billing not configured" });
      return;
    }
    const sig = req.headers["stripe-signature"];
    let event: Stripe.Event;
    try {
      // req.body is a Buffer here (mounted with express.raw before express.json).
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
          if (!subId) break;
          const sub = await stripe.subscriptions.retrieve(subId);
          const org = (await orgForSubscription(sub)) ?? (await orgFromReference(session));
          if (org) await syncFromSubscription(org, sub);
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const org = await orgForSubscription(sub);
          if (org) await syncFromSubscription(org, sub);
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          if (!customerId) break;
          const resolved = await resolveOrgByStripeCustomer(customerId);
          if (resolved) {
            await db
              .update(organizationSubscriptionsTable)
              .set({ status: "past_due", updatedAt: new Date() })
              .where(eq(organizationSubscriptionsTable.organizationId, resolved.org.id));
          }
          break;
        }
        default:
          break; // ignore other event types
      }
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, type: event.type }, "Stripe webhook handler failed");
      // 500 so Stripe retries.
      res.status(500).json({ error: "Webhook handler error" });
    }
  })();
};

// Fallback org resolution for checkout: the session's client_reference_id is the
// org id we set when creating the Checkout Session.
async function orgFromReference(session: Stripe.Checkout.Session): Promise<Organization | null> {
  const orgId = Number(session.client_reference_id);
  if (!Number.isInteger(orgId)) return null;
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  return org ?? null;
}
