import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, mcpTokensTable, usersTable } from "@workspace/db";

// Raw tokens look like `tvmcp_<40 hex>`; the prefix stored for display is the
// first 12 chars (`tvmcp_1a2b3`), which leaks nothing useful.
const TOKEN_BYTES = 20;
const PREFIX_LEN = 12;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawToken(): string {
  return `tvmcp_${randomBytes(TOKEN_BYTES).toString("hex")}`;
}

export interface McpTokenListItem {
  id: number;
  label: string;
  tokenPrefix: string;
  createdByName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listMcpTokens(): Promise<McpTokenListItem[]> {
  const rows = await db
    .select({
      id: mcpTokensTable.id,
      label: mcpTokensTable.label,
      tokenPrefix: mcpTokensTable.tokenPrefix,
      createdByName: usersTable.name,
      createdAt: mcpTokensTable.createdAt,
      lastUsedAt: mcpTokensTable.lastUsedAt,
    })
    .from(mcpTokensTable)
    .leftJoin(usersTable, eq(mcpTokensTable.createdById, usersTable.id))
    .orderBy(desc(mcpTokensTable.createdAt));
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    tokenPrefix: r.tokenPrefix,
    createdByName: r.createdByName ?? null,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }));
}

/** Create a token, returning the raw value ONCE (never retrievable again). */
export async function createMcpToken(
  label: string,
  createdById: number | null,
): Promise<{ token: string; item: McpTokenListItem }> {
  const raw = generateRawToken();
  const [row] = await db
    .insert(mcpTokensTable)
    .values({
      label,
      tokenHash: hashToken(raw),
      tokenPrefix: raw.slice(0, PREFIX_LEN),
      createdById,
    })
    .returning();
  const [createdByName] = createdById
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, createdById))
    : [{ name: null }];
  return {
    token: raw,
    item: {
      id: row.id,
      label: row.label,
      tokenPrefix: row.tokenPrefix,
      createdByName: createdByName?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: null,
    },
  };
}

/** Revoke (delete) a token by id; returns whether a row was removed. */
export async function deleteMcpToken(id: number): Promise<boolean> {
  const deleted = await db.delete(mcpTokensTable).where(eq(mcpTokensTable.id, id)).returning({ id: mcpTokensTable.id });
  return deleted.length > 0;
}

// Throttle last-used writes so a polling client doesn't write per request.
const LAST_USED_WRITE_INTERVAL_MS = 60_000;
const lastUsedWrites = new Map<number, number>();

/**
 * Verify a candidate token against the DB. Returns the token id on success
 * (null otherwise), and best-effort stamps last_used_at (throttled).
 * `nowMs` is injected so the gateway avoids Date.now() in hot paths having
 * to import it; callers pass Date.now().
 */
export async function verifyMcpToken(raw: string, nowMs: number): Promise<number | null> {
  if (!raw) return null;
  const [row] = await db
    .select({ id: mcpTokensTable.id })
    .from(mcpTokensTable)
    .where(eq(mcpTokensTable.tokenHash, hashToken(raw)))
    .limit(1);
  if (!row) return null;

  const last = lastUsedWrites.get(row.id) ?? 0;
  if (nowMs - last >= LAST_USED_WRITE_INTERVAL_MS) {
    lastUsedWrites.set(row.id, nowMs);
    void db
      .update(mcpTokensTable)
      .set({ lastUsedAt: new Date(nowMs) })
      .where(eq(mcpTokensTable.id, row.id))
      .catch(() => {});
  }
  return row.id;
}
