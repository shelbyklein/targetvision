import { Router, type IRouter } from "express";
import { and, avg, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, notInArray, or } from "drizzle-orm";
import {
  db,
  albumsTable,
  photosTable,
  ratingsTable,
  usersTable,
  tagsTable,
  collectionTagsTable,
  photoCollectionsTable,
  aiAnalysisEventsTable,
} from "@workspace/db";
import { SearchPhotosResponse } from "@workspace/api-zod";
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
  albumId?: number;
  aiStatus?: "has_description" | "failed" | "not_analysed";
  inCollection?: boolean;
  hasRating?: boolean;
}

async function applyFiltersAndFetchIds(
  baseIds: number[],
  filters: PhotoFilterOptions,
): Promise<number[]> {
  let ids = baseIds;

  const trimmedSearch = filters.search?.trim();
  if (trimmedSearch) {
    const pattern = `%${trimmedSearch}%`;
    const words = trimmedSearch.split(/\s+/).filter(Boolean);
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
      db.select({ id: photosTable.id }).from(photosTable).where(
        or(...words.map((word) => ilike(photosTable.aiDescription, `%${word}%`)))
      ),
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

  if (filters.albumId != null) {
    const albumFiltered = await db
      .select({ id: photosTable.id })
      .from(photosTable)
      .where(eq(photosTable.albumId, filters.albumId));
    const albumPhotoIds = new Set(albumFiltered.map((r) => r.id));
    ids = ids.filter((id) => albumPhotoIds.has(id));
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

  if (filters.aiStatus) {
    if (filters.aiStatus === "has_description") {
      const rows = await db
        .select({ id: photosTable.id })
        .from(photosTable)
        .where(isNotNull(photosTable.aiDescription));
      const aiIds = new Set(rows.map((r) => r.id));
      ids = ids.filter((id) => aiIds.has(id));
    } else if (filters.aiStatus === "not_analysed") {
      const withEvents = await db
        .selectDistinct({ photoId: aiAnalysisEventsTable.photoId })
        .from(aiAnalysisEventsTable);
      const withEventIds = new Set(withEvents.map((r) => r.photoId).filter((id): id is number => id != null));
      ids = ids.filter((id) => !withEventIds.has(id));
    } else if (filters.aiStatus === "failed") {
      const allEvents = await db
        .select({
          photoId: aiAnalysisEventsTable.photoId,
          status: aiAnalysisEventsTable.status,
        })
        .from(aiAnalysisEventsTable)
        .orderBy(desc(aiAnalysisEventsTable.createdAt));
      const latestStatusMap = new Map<number, string>();
      for (const event of allEvents) {
        if (event.photoId != null && !latestStatusMap.has(event.photoId)) {
          latestStatusMap.set(event.photoId, event.status);
        }
      }
      ids = ids.filter((id) => latestStatusMap.get(id) === "failed");
    }
  }

  if (filters.inCollection != null) {
    const inCollectionRows = await db
      .selectDistinct({ photoId: photoCollectionsTable.photoId })
      .from(photoCollectionsTable);
    const collectionPhotoIds = new Set(
      inCollectionRows.map((r) => r.photoId).filter((id): id is number => id != null),
    );
    if (filters.inCollection) {
      ids = ids.filter((id) => collectionPhotoIds.has(id));
    } else {
      ids = ids.filter((id) => !collectionPhotoIds.has(id));
    }
  }

  if (filters.hasRating != null) {
    const ratedRows = await db
      .selectDistinct({ photoId: ratingsTable.photoId })
      .from(ratingsTable);
    const ratedIds = new Set(ratedRows.map((r) => r.photoId));
    if (filters.hasRating) {
      ids = ids.filter((id) => ratedIds.has(id));
    } else {
      ids = ids.filter((id) => !ratedIds.has(id));
    }
  }

  return ids;
}

router.get("/search", requireAuth, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json(SearchPhotosResponse.parse([]));
    return;
  }

  const ratingMin = req.query.ratingMin ? parseFloat(String(req.query.ratingMin)) : undefined;
  const ratingMax = req.query.ratingMax ? parseFloat(String(req.query.ratingMax)) : undefined;
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const uploaderId = req.query.uploaderId ? parseInt(String(req.query.uploaderId), 10) : undefined;
  const includeHidden = req.query.includeHidden === "true";
  const canSeeHidden = req.dbUser!.role === "admin" && includeHidden;

  const pattern = `%${q}%`;

  const hiddenCondition = canSeeHidden ? undefined : eq(photosTable.isHidden, false);

  const [byAlbumTitle, byUploader, byAiDescription] = await Promise.all([
    db
      .select({ id: photosTable.id })
      .from(photosTable)
      .innerJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
      .where(hiddenCondition ? and(ilike(albumsTable.title, pattern), hiddenCondition) : ilike(albumsTable.title, pattern)),
    db
      .select({ id: photosTable.id })
      .from(photosTable)
      .innerJoin(usersTable, eq(photosTable.uploaderId, usersTable.id))
      .where(hiddenCondition ? and(ilike(usersTable.name, pattern), hiddenCondition) : ilike(usersTable.name, pattern)),
    db
      .select({ id: photosTable.id })
      .from(photosTable)
      .where(hiddenCondition ? and(ilike(photosTable.aiDescription, pattern), hiddenCondition) : ilike(photosTable.aiDescription, pattern)),
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
  res.json(SearchPhotosResponse.parse(photos.filter(Boolean)));
});

export { applyFiltersAndFetchIds };
export default router;
