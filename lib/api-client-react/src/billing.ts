import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// The active org's plan, storage usage vs cap, and subscription state (#118).
// `capBytes: null` means unlimited (Enterprise). `canManage` is true for org
// owners/admins and instance admins — they may start checkout / open the portal.
export type BillingStatus = {
  plan: string;
  planLabel: string;
  capBytes: number | null;
  usageBytes: number;
  ratio: number;
  nearLimit: boolean;
  overLimit: boolean;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  canManage: boolean;
};

const BILLING_STATUS_KEY = ["billing", "status"] as const;

export function useBillingStatus() {
  return useQuery({
    queryKey: BILLING_STATUS_KEY,
    queryFn: () => customFetch<BillingStatus>("/api/billing/status"),
  });
}

// Start a self-serve Pro upgrade. Returns a Stripe Checkout URL; the caller
// redirects the browser to it. The webhook (not this call) flips the plan.
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: () =>
      customFetch<{ url: string }>("/api/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}

// Open the Stripe Customer Portal (update payment method, upgrade/downgrade,
// cancel). Returns a URL the caller redirects to.
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () =>
      customFetch<{ url: string }>("/api/billing/create-portal-session", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}

// Invalidate cached billing status — call after returning from checkout so the
// plan/usage reflect the completed subscription.
export function useInvalidateBillingStatus() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BILLING_STATUS_KEY });
}
