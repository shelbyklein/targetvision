import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, user, session, account, verification } from "@workspace/db";
import { loadAppSettings } from "./aiProviders";

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
            throw new APIError("FORBIDDEN", {
              message: "Registration is currently disabled",
            });
          }
          return { data: user };
        },
      },
    },
  },
});
