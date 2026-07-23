import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  organizationsTable,
  organizationMembersTable,
  organizationSubscriptionsTable,
  photosTable,
  usersTable,
} from "@workspace/db";
import { AdminOrganizationsResponse, JoinOrganizationResponse, planCapBytes } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAuth";

// Platform superadmin routes (issue #120): the operator's cross-org view.
// requireAdmin only — these deliberately do NOT go through requireOrg, because
// they exist to see every organization, not to act inside one. Acting inside a
// customer org still requires membership (join-on-demand below) so the tenancy
// membership check stays the single wall between orgs.

const router: IRouter = Router();

// GET /admin/organizations — every org with plan, subscription status, member
// roster, photo count, and storage usage. The roster doubles as the per-user
// membership source for the platform Users page.
router.get("/admin/organizations", requireAdmin, async (req, res): Promise<void> => {
  const orgs = await db.select().from(organizationsTable).orderBy(asc(organizationsTable.id));

  const members = await db
    .select({
      organizationId: organizationMembersTable.organizationId,
      userId: organizationMembersTable.userId,
      role: organizationMembersTable.role,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(organizationMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, organizationMembersTable.userId))
    .orderBy(asc(organizationMembersTable.createdAt));

  const photoStats = await db
    .select({
      organizationId: photosTable.organizationId,
      photoCount: sql<number>`count(*)::int`,
      usageBytes: sql<number>`coalesce(sum(${photosTable.filesize}), 0)::bigint`,
    })
    .from(photosTable)
    .groupBy(photosTable.organizationId);

  const subs = await db.select().from(organizationSubscriptionsTable);

  const statsByOrg = new Map(photoStats.map((s) => [s.organizationId, s]));
  const subByOrg = new Map(subs.map((s) => [s.organizationId, s]));
  const membersByOrg = new Map<number, typeof members>();
  for (const m of members) {
    const list = membersByOrg.get(m.organizationId) ?? [];
    list.push(m);
    membersByOrg.set(m.organizationId, list);
  }

  const me = req.dbUser!;
  const payload = orgs.map((org) => {
    const roster = membersByOrg.get(org.id) ?? [];
    const stats = statsByOrg.get(org.id);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      subscriptionStatus: subByOrg.get(org.id)?.status ?? "inactive",
      memberCount: roster.length,
      photoCount: stats?.photoCount ?? 0,
      usageBytes: Number(stats?.usageBytes ?? 0),
      capBytes: planCapBytes(org.plan),
      createdAt: org.createdAt.toISOString(),
      myRole: roster.find((m) => m.userId === me.id)?.role ?? null,
      members: roster.map(({ userId, name, email, role }) => ({ userId, name, email, role })),
    };
  });

  res.json(AdminOrganizationsResponse.parse(payload));
});

// POST /admin/organizations/:id/join — join-on-demand support access: add the
// calling platform admin to the org as an org-admin. Transparent by design (the
// customer sees them in the member list). Idempotent: an existing membership is
// left untouched (never demotes an owner).
router.post("/admin/organizations/:id/join", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const orgId = Number.parseInt(raw, 10);
  if (!Number.isInteger(orgId)) {
    res.status(400).json({ error: "Invalid organization id" });
    return;
  }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const me = req.dbUser!;
  const [existing] = await db
    .select({ role: organizationMembersTable.role })
    .from(organizationMembersTable)
    .where(
      sql`${organizationMembersTable.organizationId} = ${orgId} and ${organizationMembersTable.userId} = ${me.id}`,
    );
  if (existing) {
    res.json(JoinOrganizationResponse.parse({ organizationId: orgId, role: existing.role, alreadyMember: true }));
    return;
  }

  // onConflictDoNothing covers the race where a membership appeared between the
  // check and the insert (e.g. a concurrent invite acceptance).
  await db
    .insert(organizationMembersTable)
    .values({ organizationId: orgId, userId: me.id, role: "admin" })
    .onConflictDoNothing();

  res.json(JoinOrganizationResponse.parse({ organizationId: orgId, role: "admin", alreadyMember: false }));
});

export default router;
