import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Forward slashes: drizzle-kit's glob matching fails on Windows backslash paths
  schema: path.join(__dirname, "./src/schema/index.ts").split(path.sep).join("/"),
  // Relative (not absolute): drizzle-kit's `generate` path.joins this with the
  // cwd when reconstructing snapshot paths, and an absolute value produces a
  // doubled path on Windows. `migrate` resolves its own folder, so this only
  // affects generate/push.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
