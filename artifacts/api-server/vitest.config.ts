import { defineConfig } from "vitest/config";

// Integration tests talk to a real Postgres. Point them at a dedicated test
// database (never the dev/prod DB). CI provides TEST_DATABASE_URL; locally we
// default to the `targetvision_test` database on the docker Postgres (port 5433).
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/targetvision_test";

export default defineConfig({
  test: {
    // `env` overrides process.env for the test worker, so a DATABASE_URL set in
    // the developer's shell can never leak the dev database into the tests.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AI_KEY_ENCRYPTION_SECRET:
        process.env.AI_KEY_ENCRYPTION_SECRET ?? "test-ai-key-encryption-secret-0000000000000000",
    },
    // Integration tests share one Postgres and truncate between tests, so they
    // must not run concurrently within a file.
    sequence: { concurrent: false },
  },
});
