import { z } from "zod/v4";

// Subscription tiers (issue #118). The single source of truth for plan ids,
// storage caps (server enforcement), and display metadata (billing UI). Lives in
// @workspace/api-zod because it's the one contract package both the API server
// and the web app import.
export const PLAN_IDS = ["free", "pro", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

// zod enum for request bodies / validation (e.g. the admin set-plan override).
export const PlanIdSchema = z.enum(PLAN_IDS);

export interface PlanLimits {
  // Storage cap in bytes. `null` = unlimited (Enterprise) — enforcement
  // short-circuits on null rather than doing MAX_SAFE_INTEGER arithmetic.
  bytes: number | null;
  label: string;
  blurb: string;
  priceDisplay: string;
}

const GB = 1024 * 1024 * 1024;

// Caps + copy. Adjust here to change pricing tiers everywhere. The Pro price
// itself is configured in Stripe and referenced by STRIPE_PRICE_PRO.
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    bytes: 2 * GB,
    label: "Free",
    blurb: "Get started — up to 2 GB of photos.",
    priceDisplay: "Free",
  },
  pro: {
    bytes: 50 * GB,
    label: "Pro",
    blurb: "For active teams — 50 GB of photos.",
    priceDisplay: "$—/mo",
  },
  enterprise: {
    bytes: null,
    label: "Enterprise",
    blurb: "Unlimited storage and priority support.",
    priceDisplay: "Contact us",
  },
};

// Warn the org when usage crosses this fraction of its cap (grace signalling;
// the hard block is at 1.0).
export const GRACE_WARNING_RATIO = 0.9;

// Resolve an org's storage cap in bytes. Fail-closed: an unknown/missing plan
// string falls back to the Free cap rather than throwing or granting more.
export function planCapBytes(plan: string): number | null {
  return (PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.free).bytes;
}
