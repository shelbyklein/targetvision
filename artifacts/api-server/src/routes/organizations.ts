import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, organizationsTable, organizationMembersTable, usersTable } from "@workspace/db";
import {
  ListMyOrganizationsResponse,
  SwitchOrganizationBody,
  SwitchOrganizationResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

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
