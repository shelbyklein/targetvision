import Stripe from "stripe";

// Shared Stripe client (issue #118). Null when STRIPE_SECRET_KEY isn't set, so
// the app still boots without billing configured — the billing routes guard on
// isStripeConfigured() and return 503 until the keys are in place. apiVersion is
// omitted so the SDK's pinned default is used (matches the account).
const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = secretKey ? new Stripe(secretKey) : null;

export const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO ?? null;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? null;

// Base web origin for Checkout success/cancel + Customer Portal return URLs.
export function billingBaseUrl(): string {
  return (process.env.BILLING_PUBLIC_BASE_URL ?? "http://localhost:8081").replace(/\/$/, "");
}

// True when self-serve checkout can run (client + a Pro price configured).
export function isStripeConfigured(): boolean {
  return stripe !== null && Boolean(STRIPE_PRICE_PRO);
}
