import { Router, type IRouter } from "express";
import { and, avg, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import {
  db,
  albumsTable,
  photosTable,
  ratingsTable,
  usersTable,
  tagsTable,
  collectionTagsTable,
  photoCollectionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotoResponse } from "../lib/photoHelpers";

const router: IRouter = Router();

interface PhotoFilterOptions {
  search?: string;
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
): Promise<number[]> {
  let ids = baseIds;

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const [byAlbumTitle, byUploader, byAiDescription] = await Promise.all([
      db
        .select({ id: photosTable.id })
        .from(photosTable)
        .innerJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
        .where(ilike(albumsTable.title, pattern)),
      db
        .select({ id: photosTable.id })
        .from(photosTable)
        .innerJoin(usersTable, eq(photosTable.uploaderId, usersTable.id))
        .where(ilike(usersTable.name, pattern)),
      db.select({ id: photosTable.id }).from(photosTable).where(ilike(photosTable.aiDescription, pattern)),
    ]);
    const searchIds = new Set([
      ...byAlbumTitle.map((r) => r.id),
      ...byUploader.map((r) => r.id),
      ...byAiDescription.map((r) => r.id),
    ]);
    ids = ids.filter((id) => searchIds.has(id));
  }

  if (filters.tag) {
    const tagName = filters.tag.trim().toLowerCase();
    const [tagRow] = await db.select({ id: tagsTable.id }).from(tagsTable).where(eq(tagsTable.name, tagName));
    if (!tagRow) {
      return [];
    }
    const collectionsWithTag = await db
      .select({ collectionId: collectionTagsTable.collectionId })
      .from(collectionTagsTable)
      .where(eq(collectionTagsTable.tagId, tagRow.id));
    const collectionIds = collectionsWithTag.map((r) => r.collectionId);
    if (collectionIds.length === 0) {
      return [];
    }
    const photosInCollections = await db
      .select({ photoId: photoCollectionsTable.photoId })
      .from(photoCollectionsTable)
      .where(inArray(photoCollectionsTable.collectionId, collectionIds));
    const tagPhotoIds = new Set(photosInCollections.map((r) => r.photoId));
    ids = ids.filter((id) => tagPhotoIds.has(id));
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

  const ratingMin = req.query.ratingMin ? parseFloat(String(req.query.ratingMin)) : undefined;
  const ratingMax = req.query.ratingMax ? parseFloat(String(req.query.ratingMax)) : undefined;
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const uploaderId = req.query.uploaderId ? parseInt(String(req.query.uploaderId), 10) : undefined;

  const pattern = `%${q}%`;

  const [byAlbumTitle, byUploader, byAiDescription] = await Promise.all([
    db
      .select({ id: photosTable.id })
      .from(photosTable)
      .innerJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
      .where(ilike(albumsTable.title, pattern)),
    db
      .select({ id: photosTable.id })
      .from(photosTable)
      .innerJoin(usersTable, eq(photosTable.uploaderId, usersTable.id))
      .where(ilike(usersTable.name, pattern)),
    db
      .select({ id: photosTable.id })
      .from(photosTable)
      .where(ilike(photosTable.aiDescription, pattern)),
  ]);

  const uniqueIds = [
    ...new Set([
      ...byAlbumTitle.map((r) => r.id),
      ...byUploader.map((r) => r.id),
      ...byAiDescription.map((r) => r.id),
    ]),
  ];

  const filtered = await applyFiltersAndFetchIds(uniqueIds, {
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
