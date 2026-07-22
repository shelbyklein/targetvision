import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, organizationsTable, organizationMembersTable, usersTable } from "@workspace/db";
import {
  ListMyOrganizationsResponse,
  SwitchOrganizationBody,
  SwitchOrganizationResponse,
  CreateOrganizationBody,
  CreateOrganizationResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Turn an org name into a URL-safe slug. Uniqueness is resolved by the caller
// (appends -2, -3, … on collision).
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "org";
}

async function uniqueSlug(base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [existing] = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, candidate));
    if (!existing) return candidate;
  }
}

// Shared projection: an org the user belongs to, with their role in it.
const myOrgColumns = {
  id: organizationsTable.id,
  name: organizationsTable.name,
  slug: organizationsTable.slug,
  role: organizationMembersTable.role,
};

// GET /organizations — every org the current user belongs to. The web client
// uses this to populate its org switcher; the chosen id goes back as the
// X-Organization-Id header (see requireOrg).
router.get("/organizations", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select(myOrgColumns)
    .from(organizationMembersTable)
    .innerJoin(organizationsTable, eq(organizationMembersTable.organizationId, organizationsTable.id))
    .where(eq(organizationMembersTable.userId, req.dbUser!.id))
    .orderBy(asc(organizationMembersTable.createdAt), asc(organizationsTable.id));
  res.json(ListMyOrganizationsResponse.parse(rows));
});

// POST /organizations — create a new org; the caller becomes its owner and it
// becomes their sticky active org. This is the "no org yet → create one" path
// for a freshly signed-up user (and lets any user spin up another org).
router.post("/organizations", requireAuth, async (req, res): Promise<void> => {
  const body = CreateOrganizationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const name = body.data.name.trim();
  const slug = await uniqueSlug(slugify(name));

  const created = await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizationsTable).values({ name, slug }).returning();
    await tx.insert(organizationMembersTable).values({
      organizationId: org.id,
      userId: req.dbUser!.id,
      role: "owner",
    });
    await tx.update(usersTable).set({ lastActiveOrgId: org.id }).where(eq(usersTable.id, req.dbUser!.id));
    return org;
  });

  res.status(201).json(
    CreateOrganizationResponse.parse({ id: created.id, name: created.name, slug: created.slug, role: "owner" }),
  );
});

// POST /organizations/switch — persist the sticky active org. Must be a real
// membership; returns 403 otherwise so a client can't pin an org it can't access.
router.post("/organizations/switch", requireAuth, async (req, res): Promise<void> => {
  const body = SwitchOrganizationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [membership] = await db
    .select(myOrgColumns)
    .from(organizationMembersTable)
    .innerJoin(organizationsTable, eq(organizationMembersTable.organizationId, organizationsTable.id))
    .where(
      and(
        eq(organizationMembersTable.userId, req.dbUser!.id),
        eq(organizationMembersTable.organizationId, body.data.organizationId),
      ),
    );

  if (!membership) {
    res.status(403).json({ error: "Not a member of this organization" });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastActiveOrgId: membership.id })
    .where(eq(usersTable.id, req.dbUser!.id));

  res.json(SwitchOrganizationResponse.parse(membership));
});

export default router;
