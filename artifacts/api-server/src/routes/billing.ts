import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organizationSubscriptionsTable } from "@workspace/db";
import {
  BillingStatusResponse,
  CheckoutSessionResponse,
  PortalSessionResponse,
} from "@workspace/api-zod";
import { requireOrgAuth, requireOrgRole } from "../middlewares/requireOrg";
import { stripe, STRIPE_PRICE_PRO, isStripeConfigured, billingBaseUrl } from "../lib/stripe";
import { getBillingStatus, loadOrgSubscription } from "../lib/billing/subscriptions";

const router: IRouter = Router();

// Billing management (checkout/portal) is an org-admin action; status is visible
// to any member. Instance admins pass requireOrgRole automatically.
const requireOrgAdmin = [requireOrgAuth, requireOrgRole("owner", "admin")] as const;

// GET /billing/status — the active org's plan, storage usage vs cap, and
// subscription state. Any member may view; managers get canManage=true.
router.get("/billing/status", requireOrgAuth, async (req, res): Promise<void> => {
  const status = await getBillingStatus(req.org!);
  const canManage = req.dbUser?.role === "admin" || req.orgRole === "owner" || req.orgRole === "admin";
  res.json(BillingStatusResponse.parse({ ...status, canManage }));
});

// POST /billing/create-checkout-session — start a self-serve Pro upgrade. Returns
// a Stripe Checkout URL for the client to redirect to. The webhook (not this
// route) flips the plan once payment completes.
router.post("/billing/create-checkout-session", ...requireOrgAdmin, async (req, res): Promise<void> => {
  if (!isStripeConfigured() || !stripe) {
    res.status(503).json({ error: "Billing is not configured" });
    return;
  }
  const org = req.org!;
  const sub = await loadOrgSubscription(org.id);

  // Ensure a Stripe customer, recording the org id both in Stripe metadata and
  // our DB so the webhook can resolve the org either way.
  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organizationId: String(org.id) },
    });
    customerId = customer.id;
    await db
      .update(organizationSubscriptionsTable)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(organizationSubscriptionsTable.organizationId, org.id));
  }

  const base = billingBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_PRO!, quantity: 1 }],
    success_url: `${base}/admin/billing?checkout=success`,
    cancel_url: `${base}/admin/billing?checkout=cancel`,
    client_reference_id: String(org.id),
    subscription_data: { metadata: { organizationId: String(org.id) } },
  });

  if (!session.url) {
    res.status(502).json({ error: "Stripe did not return a checkout URL" });
    return;
  }
  res.json(CheckoutSessionResponse.parse({ url: session.url }));
});

// POST /billing/create-portal-session — open the Stripe Customer Portal so the
// org can update payment method, upgrade/downgrade, or cancel.
router.post("/billing/create-portal-session", ...requireOrgAdmin, async (req, res): Promise<void> => {
  if (!stripe) {
    res.status(503).json({ error: "Billing is not configured" });
    return;
  }
  const sub = await loadOrgSubscription(req.org!.id);
  if (!sub.stripeCustomerId) {
    res.status(400).json({ error: "No subscription to manage yet" });
    return;
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${billingBaseUrl()}/admin/billing`,
  });
  res.json(PortalSessionResponse.parse({ url: session.url }));
});

export default router;
