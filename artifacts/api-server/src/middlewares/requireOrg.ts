import { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { db, organizationsTable, organizationMembersTable, usersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "./requireAuth";

declare global {
  namespace Express {
    interface Request {
      // The organization this request acts within (issue #113). Set by requireOrg.
      org?: typeof organizationsTable.$inferSelect;
      // The caller's role in req.org: "owner" | "admin" | "member".
      orgRole?: string;
    }
  }
}

// Header the web client sends to pick the active org. Case-insensitive lookup
// (Node lowercases header keys). Falls back to the user's sticky last-active org
// or their sole membership when absent.
const ORG_HEADER = "x-organization-id";

// Resolves the request's organization and asserts the caller is a member.
// MUST run after requireAuth (reads req.dbUser). Sets req.org + req.orgRole, and
// persists the resolved org as the user's sticky selection when it changes.
export const requireOrg = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.dbUser;
  if (!user) {
    // requireAuth should have run first; fail closed if the chain is misordered.
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Every org the user belongs to, with their role. Earliest-joined first so the
  // no-header/no-sticky fallback is deterministic.
  const memberships = await db
    .select({ org: organizationsTable, role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .innerJoin(organizationsTable, eq(organizationMembersTable.organizationId, organizationsTable.id))
    .where(eq(organizationMembersTable.userId, user.id))
    .orderBy(asc(organizationMembersTable.createdAt), asc(organizationsTable.id));

  if (memberships.length === 0) {
    res.status(403).json({ error: "You do not belong to any organization" });
    return;
  }

  const headerRaw = req.headers[ORG_HEADER];
  const headerVal = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const requestedId = headerVal ? Number.parseInt(headerVal, 10) : Number.NaN;

  let chosen: (typeof memberships)[number] | undefined;
  if (!Number.isNaN(requestedId)) {
    // Explicit header: must be a real membership, else 403 (don't silently fall
    // back — that would mask a client targeting an org it can't access).
    chosen = memberships.find((m) => m.org.id === requestedId);
    if (!chosen) {
      res.status(403).json({ error: "Not a member of this organization" });
      return;
    }
  } else {
    // No header: sticky last-active org if still a member, else earliest membership.
    if (user.lastActiveOrgId != null) {
      chosen = memberships.find((m) => m.org.id === user.lastActiveOrgId);
    }
    chosen ??= memberships[0];
  }

  req.org = chosen.org;
  req.orgRole = chosen.role;

  // Persist the sticky selection when it changed. Fire-and-forget — the request
  // shouldn't wait on it, and a failure here must not fail the request.
  if (user.lastActiveOrgId !== chosen.org.id) {
    const orgId = chosen.org.id;
    void (async () => {
      try {
        await db.update(usersTable).set({ lastActiveOrgId: orgId }).where(eq(usersTable.id, user.id));
      } catch {
        /* sticky-org persistence is best-effort */
      }
    })();
  }

  next();
};

// Auth + org context for tenant routes: `router.get(path, requireOrgAuth, handler)`.
// Express flattens the array, running requireAuth then requireOrg before the handler.
export const requireOrgAuth: RequestHandler[] = [requireAuth, requireOrg];

// Guards an org-scoped action to callers holding one of `roles` in req.org
// (e.g. requireOrgRole("owner", "admin") for member management). Runs after
// requireOrg. Instance superadmins (users.role === "admin") always pass.
export const requireOrgRole = (...roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.dbUser?.role === "admin") {
      next();
      return;
    }
    if (!req.orgRole || !roles.includes(req.orgRole)) {
      res.status(403).json({ error: "Forbidden: insufficient organization role" });
      return;
    }
    next();
  };
};
