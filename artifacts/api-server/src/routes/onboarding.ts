import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  albumsTable,
  photosTable,
  collectionsTable,
  photoCollectionsTable,
  organizationMembersTable,
  organizationInvitesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrgAuth } from "../middlewares/requireOrg";
import { buildServiceStatus } from "../lib/serviceStatus";

const router: IRouter = Router();

// Getting-started checklist signals (#148). All derived from real data so the
// steps tick themselves off as the user acts — nothing here is stored except
// the per-user dismissal timestamp. Any org member may read their org's status.
router.get("/onboarding/status", requireOrgAuth, async (req, res): Promise<void> => {
  const orgId = req.org!.id;

  const existsIn = async (query: Promise<unknown[]>) => (await query).length > 0;

  const [hasPhotos, hasAlbums, hasCollectionPhotos, memberRows, inviteRows, serviceStatus] =
    await Promise.all([
      existsIn(
        db.select({ one: sql`1` }).from(photosTable).where(eq(photosTable.organizationId, orgId)).limit(1),
      ),
      existsIn(
        db.select({ one: sql`1` }).from(albumsTable).where(eq(albumsTable.organizationId, orgId)).limit(1),
      ),
      // A photo added to any of this org's collections — the core curation act.
      existsIn(
        db
          .select({ one: sql`1` })
          .from(photoCollectionsTable)
          .innerJoin(collectionsTable, eq(photoCollectionsTable.collectionId, collectionsTable.id))
          .where(eq(collectionsTable.organizationId, orgId))
          .limit(1),
      ),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(organizationMembersTable)
        .where(eq(organizationMembersTable.organizationId, orgId)),
      db
        .select({ one: sql`1` })
        .from(organizationInvitesTable)
        .where(eq(organizationInvitesTable.organizationId, orgId))
        .limit(1),
      buildServiceStatus({ organizationId: orgId }),
    ]);

  const memberCount = Number(memberRows[0]?.n ?? 0);
  const aiConfigured = serviceStatus.services.find((s) => s.key === "ai")?.ok ?? false;

  res.json({
    hasPhotos,
    hasAlbums,
    hasCollectionPhotos,
    aiConfigured,
    memberCount,
    // "Invited a teammate" counts a second member OR a still-pending invite.
    invitedTeammate: memberCount > 1 || inviteRows.length > 0,
    dismissed: req.dbUser!.onboardingDismissedAt != null,
  });
});

// Dismiss the checklist for this user (all orgs, all devices).
router.post("/onboarding/dismiss", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({ onboardingDismissedAt: new Date() })
    .where(and(eq(usersTable.id, req.dbUser!.id)));
  res.sendStatus(204);
});

export default router;
