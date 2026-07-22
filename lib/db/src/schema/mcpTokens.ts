import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

// Bearer/URL tokens for the remote MCP gateway, managed by admins inside the
// app. Only the SHA-256 hash of each token is stored — the raw value is shown
// once at creation and never again. `tokenPrefix` is a short non-secret slice
// kept for display so admins can tell tokens apart in the list.
export const mcpTokensTable = pgTable(
  "mcp_tokens",
  {
    id: serial("id").primaryKey(),
    // The org this token grants access to (issue #113, Phase 5): the gateway
    // scopes every tool call to it, so an external client only ever sees this
    // org's library.
    organizationId: integer("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdById: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [index("mcp_tokens_token_hash_idx").on(table.tokenHash)],
);

export type McpToken = typeof mcpTokensTable.$inferSelect;
