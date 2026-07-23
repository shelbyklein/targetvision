-- Grandfather existing users when email verification becomes required.
-- Runs exactly once (tracked in drizzle.__drizzle_migrations), so accounts that
-- predate the requireEmailVerification flag stay usable; only genuinely new
-- signups afterward must click the verification link. Idempotent regardless.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
