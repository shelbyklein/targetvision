import { Router, type IRouter } from "express";
import { eq, desc, count, avg, sql } from "drizzle-orm";
import { db, albumsTable, photosTable, usersTable, tagsTable, photoTagsTable, ratingsTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetRecentPhotosResponse,
  GetTopRatedPhotosResponse,
  GetTagCloudResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotoResponse } from "../lib/photoHelpers";

const router: IRouter = Router();

router.get("/stats/dashboard", requireAuth, async (req, res): Promise<void> => {
  const [albumCount] = await db.select({ count: count() }).from(albumsTable);
  const [photoCount] = await db.select({ count: count() }).from(photosTable);
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [tagCount] = await db.select({ count: count() }).from(tagsTable);

  const recentPhotoRows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .orderBy(desc(photosTable.createdAt))
    .limit(8);

  const recentActivity = await Promise.all(
    recentPhotoRows.map((p) => buildPhotoResponse(p.id, req.dbUser?.id))
  );

  res.json(
    GetDashboardStatsResponse.parse({
      totalAlbums: Number(albumCount.count),
      totalPhotos: Number(photoCount.count),
      totalUsers: Number(userCount.count),
      totalTags: Number(tagCount.count),
      recentActivity: recentActivity.filter(Boolean),
    })
  );
});

router.get("/stats/recent-photos", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .orderBy(desc(photosTable.createdAt))
    .limit(12);

  const photos = await Promise.all(rows.map((p) => buildPhotoResponse(p.id, req.dbUser?.id)));
  res.json(GetRecentPhotosResponse.parse(photos.filter(Boolean)));
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

  const photos = await Promise.all(rows.map((p) => buildPhotoResponse(p.id, req.dbUser?.id)));
  res.json(GetTopRatedPhotosResponse.parse(photos.filter(Boolean)));
});

router.get("/stats/tag-cloud", requireAuth, async (req, res): Promise<void> => {
  const tagCounts = await db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
      count: count(photoTagsTable.photoId),
    })
    .from(tagsTable)
    .leftJoin(photoTagsTable, eq(tagsTable.id, photoTagsTable.tagId))
    .groupBy(tagsTable.id, tagsTable.name)
    .orderBy(desc(count(photoTagsTable.photoId)));

  res.json(
    GetTagCloudResponse.parse(
      tagCounts.map((t) => ({ id: t.id, name: t.name, count: Number(t.count) }))
    )
  );
});

export default router;
