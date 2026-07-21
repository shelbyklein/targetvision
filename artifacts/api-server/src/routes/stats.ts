import { Router, type IRouter } from "express";
import { desc, count, avg, eq } from "drizzle-orm";
import { db, albumsTable, photosTable, usersTable, ratingsTable, collectionsTable, projectsTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentPhotosResponse,
  GetTopRatedPhotosResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotosResponse } from "../lib/photoHelpers";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, async (req, res): Promise<void> => {
  const [albumCount, photoCount, userCount, collectionCount, projectCount, peopleCount] = await Promise.all([
    db.select({ count: count() }).from(albumsTable),
    db.select({ count: count() }).from(photosTable),
    db.select({ count: count() }).from(usersTable),
    // People are person-kind collections — count the two kinds separately.
    db.select({ count: count() }).from(collectionsTable).where(eq(collectionsTable.kind, "collection")),
    db.select({ count: count() }).from(projectsTable),
    db.select({ count: count() }).from(collectionsTable).where(eq(collectionsTable.kind, "person")),
  ]);

  const recentPhotoRows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .orderBy(desc(photosTable.createdAt))
    .limit(8);

  const recentActivity = await buildPhotosResponse(recentPhotoRows.map((p) => p.id), req.dbUser?.id);

  res.json(
    GetDashboardStatsResponse.parse({
      totalAlbums: Number(albumCount[0].count),
      totalPhotos: Number(photoCount[0].count),
      totalUsers: Number(userCount[0].count),
      totalTags: 0,
      totalCollections: Number(collectionCount[0].count),
      totalProjects: Number(projectCount[0].count),
      totalPeople: Number(peopleCount[0].count),
      recentActivity,
    })
  );
});

router.get("/stats/recent-photos", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .orderBy(desc(photosTable.createdAt))
    .limit(12);

  const photos = await buildPhotosResponse(rows.map((p) => p.id), req.dbUser?.id);
  res.json(GetRecentPhotosResponse.parse(photos));
});

router.get("/stats/top-rated", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: photosTable.id,
      avgRating: avg(ratingsTable.score),
    })
    .from(photosTable)
    .innerJoin(ratingsTable, eq(ratingsTable.photoId, photosTable.id))
    .groupBy(photosTable.id)
    .orderBy(desc(avg(ratingsTable.score)))
    .limit(12);

  const photos = await buildPhotosResponse(rows.map((p) => p.id), req.dbUser?.id);
  res.json(GetTopRatedPhotosResponse.parse(photos));
});

export default router;
