import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db, user, session, account, verification, organizationInvitesTable } from "@workspace/db";
import { loadAppSettings } from "./aiProviders";
import { sendEmail, appUrl, adminAlertEmail } from "./email";
import { passwordResetEmail, adminNewSignupEmail } from "./email/templates";
import { logger } from "./logger";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
    // Send the reset link to our own frontend page (which calls the Better Auth
    // client's resetPassword with the token), not Better Auth's default handler
    // URL. Best-effort: if SMTP is unconfigured, sendEmail logs and no-ops.
    sendResetPassword: async ({ user, token }) => {
      const url = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
      const { subject, html, text } = passwordResetEmail(url);
      await sendEmail({ to: user.email, subject, html, text });
    },
  },
  trustedOrigins: [
    "http://localhost:8081",
    "http://localhost:8080",
    ...(process.env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const settings = await loadAppSettings();
          if (!settings.registrationEnabled) {
            // An email with a pending org invite may still sign up even when
            // instance registration is off (#113 Phase 4c).
            const email = (user.email ?? "").toLowerCase();
            const [invite] = email
              ? await db
                  .select({ id: organizationInvitesTable.id })
                  .from(organizationInvitesTable)
                  .where(eq(organizationInvitesTable.email, email))
              : [];
            if (!invite) {
              throw new APIError("FORBIDDEN", {
                message: "Registration is currently disabled",
              });
            }
          }
          return { data: user };
        },
        // Notify the operator when someone new signs up. Best-effort and never
        // blocks or fails the signup — a bad/missing SMTP config just logs.
        after: async (user) => {
          const to = adminAlertEmail();
          if (!to) return;
          try {
            const { subject, html, text } = adminNewSignupEmail(user.email, user.name ?? null);
            await sendEmail({ to, subject, html, text });
          } catch (err) {
            logger.error({ err }, "Failed to send new-signup admin alert");
          }
        },
      },
    },
  },
});
