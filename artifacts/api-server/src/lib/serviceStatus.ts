import { eq, sql } from "drizzle-orm";
import { db, organizationSettingsTable } from "@workspace/db";
import { isStripeConfigured } from "./stripe";

export type ServiceRow = { key: string; label: string; ok: boolean; optional: boolean; detail: string };
export type ServiceStatus = { ready: boolean; services: ServiceRow[] };

// Deployment readiness checks (issue #122), shared by the platform-wide view
// (superadmin hub) and the org-scoped view (org admin hub). An AI provider is
// required; billing is optional (the app degrades gracefully without Stripe).
// Database/object-storage rows were dropped (#128): if either were down the
// admin page itself wouldn't load, so they were pure noise. When
// `organizationId` is given, the AI check asks "can THIS org analyse photos"
// (its own key or the env fallback) instead of "has any org configured one".
export async function buildServiceStatus(opts: { organizationId?: number } = {}): Promise<ServiceStatus> {
  // AI: an env-level fallback (AI_INTEGRATIONS_*) serves everyone; otherwise a
  // stored per-org provider key — this org's when scoped, any org's otherwise.
  const envAi = Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
      process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
      process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  );
  const keyPresent = sql`(${organizationSettingsTable.openaiKeyCiphertext} is not null or ${organizationSettingsTable.anthropicKeyCiphertext} is not null or ${organizationSettingsTable.geminiKeyCiphertext} is not null)`;
  const [aiRow] = await db
    .select({ id: organizationSettingsTable.id })
    .from(organizationSettingsTable)
    .where(
      opts.organizationId != null
        ? sql`${eq(organizationSettingsTable.organizationId, opts.organizationId)} and ${keyPresent}`
        : keyPresent,
    )
    .limit(1);
  const aiOk = envAi || Boolean(aiRow);
  const aiDetail = aiOk
    ? envAi
      ? "Environment fallback key configured"
      : opts.organizationId != null
        ? "This organization has a provider key"
        : "At least one organization has a provider key"
    : opts.organizationId != null
      ? "No AI provider key for this organization — add one under AI Services"
      : "No org has an AI provider key and no environment fallback is set";

  const billingOk = isStripeConfigured();

  const services: ServiceRow[] = [
    { key: "ai", label: "AI provider", ok: aiOk, optional: false, detail: aiDetail },
    {
      key: "billing",
      label: "Billing (Stripe)",
      ok: billingOk,
      optional: true,
      detail: billingOk ? "Stripe configured" : "No Stripe keys — billing routes return 503",
    },
  ];

  return { ready: services.filter((s) => !s.optional).every((s) => s.ok), services };
}
