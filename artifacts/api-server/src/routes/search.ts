import { Router, type IRouter } from "express";
import { and, avg, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  albumsTable,
  photosTable,
  tagsTable,
  photoTagsTable,
  categoriesTable,
  photoCategoriesTable,
  ratingsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotoResponse } from "../lib/photoHelpers";

const router: IRouter = Router();

interface PhotoFilterOptions {
  tag?: string;
  categoryId?: number;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  uploaderId?: number;
}

async function applyFiltersAndFetchIds(
  baseIds: number[],
  filters: PhotoFilterOptions,
  currentUserId?: number,
): Promise<number[]> {
  let ids = baseIds;

  if (filters.tag) {
    const [tagRow] = await db
      .select({ id: tagsTable.id })
      .from(tagsTable)
      .where(ilike(tagsTable.name, filters.tag));
    if (!tagRow) return [];
    const tagged = await db
      .select({ photoId: photoTagsTable.photoId })
      .from(photoTagsTable)
      .where(eq(photoTagsTable.tagId, tagRow.id));
    const taggedIds = new Set(tagged.map((r) => r.photoId));
    ids = ids.filter((id) => taggedIds.has(id));
  }

  if (filters.categoryId) {
    const categorized = await db
      .select({ photoId: photoCategoriesTable.photoId })
      .from(photoCategoriesTable)
      .where(eq(photoCategoriesTable.categoryId, filters.categoryId));
    const catIds = new Set(categorized.map((r) => r.photoId));
    ids = ids.filter((id) => catIds.has(id));
  }

  if (filters.dateFrom || filters.dateTo) {
    const conditions = [];
    if (filters.dateFrom) conditions.push(gte(photosTable.takenAt, new Date(filters.dateFrom)));
    if (filters.dateTo) conditions.push(lte(photosTable.takenAt, new Date(filters.dateTo)));
    const dateFiltered = await db
      .select({ id: photosTable.id })
      .from(photosTable)
      .where(and(...conditions));
    const dateIds = new Set(dateFiltered.map((r) => r.id));
    ids = ids.filter((id) => dateIds.has(id));
  }

  if (filters.uploaderId) {
    const uploaderFiltered = await db
      .select({ id: photosTable.id })
      .from(photosTable)
      .where(eq(photosTable.uploaderId, filters.uploaderId));
    const uploaderIds = new Set(uploaderFiltered.map((r) => r.id));
    ids = ids.filter((id) => uploaderIds.has(id));
  }

  if (filters.ratingMin != null || filters.ratingMax != null) {
    const rated = await db
      .select({ photoId: ratingsTable.photoId, avg: avg(ratingsTable.score) })
      .from(ratingsTable)
      .groupBy(ratingsTable.photoId);
    const ratingMap = new Map(rated.map((r) => [r.photoId, parseFloat(String(r.avg ?? 0))]));
    ids = ids.filter((id) => {
      const r = ratingMap.get(id) ?? 0;
      if (filters.ratingMin != null && r < filters.ratingMin) return false;
      if (filters.ratingMax != null && r > filters.ratingMax) return false;
      return true;
    });
  }

  return ids;
}

router.get("/search", requireAuth, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  const categoryId = req.query.categoryId ? parseInt(String(req.query.categoryId), 10) : undefined;
  const ratingMin = req.query.ratingMin ? parseFloat(String(req.query.ratingMin)) : undefined;
  const ratingMax = req.query.ratingMax ? parseFloat(String(req.query.ratingMax)) : undefined;
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const uploaderId = req.query.uploaderId ? parseInt(String(req.query.uploaderId), 10) : undefined;

  const pattern = `%${q}%`;

  const byCaption = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(ilike(photosTable.caption, pattern));

  const byAlbumTitle = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .innerJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
    .where(ilike(albumsTable.title, pattern));

  const byTag = await db
    .select({ id: photoTagsTable.photoId })
    .from(photoTagsTable)
    .innerJoin(tagsTable, eq(photoTagsTable.tagId, tagsTable.id))
    .where(ilike(tagsTable.name, pattern));

  const byUploader = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .innerJoin(usersTable, eq(photosTable.uploaderId, usersTable.id))
    .where(ilike(usersTable.name, pattern));

  const byAiDescription = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(ilike(photosTable.aiDescription, pattern));

  const uniqueIds = [
    ...new Set([
      ...byCaption.map((r) => r.id),
      ...byAlbumTitle.map((r) => r.id),
      ...byTag.map((r) => r.id),
      ...byUploader.map((r) => r.id),
      ...byAiDescription.map((r) => r.id),
    ]),
  ];

  const filtered = await applyFiltersAndFetchIds(uniqueIds, {
    tag,
    categoryId,
    ratingMin,
    ratingMax,
    dateFrom,
    dateTo,
    uploaderId,
  });

  const photos = await Promise.all(filtered.map((id) => buildPhotoResponse(id, req.dbUser?.id)));
  res.json(photos.filter(Boolean));
});

export { applyFiltersAndFetchIds };
export default router;
