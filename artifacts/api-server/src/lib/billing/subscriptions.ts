import { eq, sql } from "drizzle-orm";
import {
  db,
  organizationsTable,
  organizationSubscriptionsTable,
  photosTable,
  type Organization,
  type OrganizationSubscription,
} from "@workspace/db";
import { PLAN_LIMITS, planCapBytes, GRACE_WARNING_RATIO, type PlanId } from "@workspace/api-zod";

// Lazy get-or-create the org's subscription row (issue #118), mirroring
// loadOrgSettings — so callers never deal with a missing row.
export async function loadOrgSubscription(organizationId: number): Promise<OrganizationSubscription> {
  const [existing] = await db
    .select()
    .from(organizationSubscriptionsTable)
    .where(eq(organizationSubscriptionsTable.organizationId, organizationId));
  if (existing) return existing;
  const [created] = await db
    .insert(organizationSubscriptionsTable)
    .values({ organizationId })
    .onConflictDoNothing()
    .returning();
  // onConflictDoNothing can race to empty on a concurrent insert — re-read.
  if (created) return created;
  const [row] = await db
    .select()
    .from(organizationSubscriptionsTable)
    .where(eq(organizationSubscriptionsTable.organizationId, organizationId));
  return row;
}

// Total storage an org is using = sum of its photos' filesizes. Null filesizes
// count as 0. This is the metric plans cap on.
export async function getOrgUsageBytes(organizationId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${photosTable.filesize}), 0)` })
    .from(photosTable)
    .where(eq(photosTable.organizationId, organizationId));
  return Number(row?.total ?? 0);
}

export interface BillingStatus {
  plan: string;
  planLabel: string;
  capBytes: number | null; // null = unlimited
  usageBytes: number;
  ratio: number; // usage/cap, 0 when unlimited
  nearLimit: boolean; // >= grace ratio, under cap
  overLimit: boolean; // at/over cap
  status: string; // stripe subscription status
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

// The single object the /billing/status route and the frontend read. Caller adds
// `canManage` (derived from the request's org role).
export async function getBillingStatus(org: Organization): Promise<BillingStatus> {
  const [usageBytes, sub] = await Promise.all([getOrgUsageBytes(org.id), loadOrgSubscription(org.id)]);
  const cap = planCapBytes(org.plan);
  const limits = PLAN_LIMITS[org.plan as PlanId] ?? PLAN_LIMITS.free;
  const ratio = cap == null ? 0 : cap === 0 ? 1 : usageBytes / cap;
  return {
    plan: org.plan,
    planLabel: limits.label,
    capBytes: cap,
    usageBytes,
    ratio,
    nearLimit: cap != null && ratio >= GRACE_WARNING_RATIO && usageBytes < cap,
    overLimit: cap != null && usageBytes >= cap,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    hasStripeCustomer: Boolean(sub.stripeCustomerId),
  };
}

// Whether an upload of `incomingBytes` is allowed under the org's plan cap.
// Enterprise (cap === null) always passes. Blocks when it would cross the cap
// (existing photos are never affected — only new uploads are refused).
export async function assertUploadAllowed(
  org: Organization,
  incomingBytes: number,
): Promise<{ allowed: boolean; usageBytes: number; capBytes: number | null }> {
  const cap = planCapBytes(org.plan);
  if (cap == null) return { allowed: true, usageBytes: 0, capBytes: null };
  const usageBytes = await getOrgUsageBytes(org.id);
  return { allowed: usageBytes + Math.max(0, incomingBytes) <= cap, usageBytes, capBytes: cap };
}

// Webhook helpers: resolve the org (+ its subscription row) a Stripe object
// belongs to, via the ids the DB stores.
export async function resolveOrgByStripeCustomer(
  customerId: string,
): Promise<{ org: Organization; sub: OrganizationSubscription } | null> {
  const [row] = await db
    .select({ org: organizationsTable, sub: organizationSubscriptionsTable })
    .from(organizationSubscriptionsTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, organizationSubscriptionsTable.organizationId))
    .where(eq(organizationSubscriptionsTable.stripeCustomerId, customerId));
  return row ?? null;
}

export async function resolveOrgByStripeSubscription(
  subscriptionId: string,
): Promise<{ org: Organization; sub: OrganizationSubscription } | null> {
  const [row] = await db
    .select({ org: organizationsTable, sub: organizationSubscriptionsTable })
    .from(organizationSubscriptionsTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, organizationSubscriptionsTable.organizationId))
    .where(eq(organizationSubscriptionsTable.stripeSubscriptionId, subscriptionId));
  return row ?? null;
}
