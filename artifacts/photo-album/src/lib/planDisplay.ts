// Display copy for the plan tiers, shared by the landing page's pricing
// section and the admin billing page (#136) so the two can't drift. This is
// marketing text only — the enforced caps are the backend's source of truth
// (PLAN_LIMITS in @workspace/api-zod), surfaced per-org via capBytes in the
// billing status.
export type PlanCardId = "free" | "pro" | "enterprise";

export const PLAN_CARDS: Record<PlanCardId, { label: string; priceDisplay: string; blurb: string }> = {
  free: { label: "Free", priceDisplay: "Free", blurb: "Get started — up to 2 GB of photos." },
  pro: { label: "Pro", priceDisplay: "$19.99/mo", blurb: "For active teams — 50 GB of photos." },
  enterprise: { label: "Enterprise", priceDisplay: "Contact us", blurb: "Unlimited storage and priority support." },
};

export const PLAN_ORDER: PlanCardId[] = ["free", "pro", "enterprise"];

export const ENTERPRISE_CONTACT = "/contact";
