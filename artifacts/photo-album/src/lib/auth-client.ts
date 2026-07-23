import { createAuthClient } from "better-auth/react";

// Requests go through the Vite /api proxy in dev (same-origin cookies).
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
});

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword } = authClient;
