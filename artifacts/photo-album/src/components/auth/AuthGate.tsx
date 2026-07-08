import React from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Renders children only when the auth state matches `when`.
 * Drop-in replacement for Clerk's <Show> route gating.
 */
export function AuthGate({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();

  if (isPending) {
    // Only one of the paired gates should show the spinner to avoid doubling it.
    if (when === "signed-in") {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }
    return null;
  }

  const signedIn = session != null;
  const matches = when === "signed-in" ? signedIn : !signedIn;
  return matches ? <>{children}</> : null;
}
