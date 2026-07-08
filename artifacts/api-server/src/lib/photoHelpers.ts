import { db, photosTable, ratingsTable, albumsTable, collectionsTable, photoCollectionsTable, photoCollectionSuggestionsTable, photoNewCollectionSuggestionsTable, usersTable, aiAnalysisEventsTable } from "@workspace/db";
import { eq, and, avg, count, desc } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const objectStorageService = new ObjectStorageService();

/**
 * Best-effort delete of a photo's original and thumbnail objects from storage.
 * Failures are logged, not thrown — the DB row is the source of truth and is
 * already gone by the time this runs.
 */
export async function deletePhotoStorageObjects(photo: {
  id: number;
  storageKey: string | null;
  thumbnailKey: string | null;
}): Promise<void> {
  for (const key of [photo.storageKey, photo.thumbnailKey]) {
    if (!key) continue;
    try {
      await objectStorageService.deleteObjectEntity(key);
    } catch (err) {
      logger.error({ err, photoId: photo.id, key }, "Failed to delete photo storage object");
    }
  }
}

export async function buildPhotoResponse(photoId: number, currentUserId?: number) {
  const [photo] = await db
    .select({
      photo: photosTable,
      albumTitle: albumsTable.title,
    })
    .from(photosTable)
    .leftJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
    .where(eq(photosTable.id, photoId));

  if (!photo) return null;

  const [photoCollections, ratingDataArr, ratingsList, suggestedCollections, suggestedNewCollections, latestAiEvents] = await Promise.all([
    db
      .select({
        id: collectionsTable.id,
        title: collectionsTable.title,
        description: collectionsTable.description,
        createdById: collectionsTable.createdById,
        createdAt: collectionsTable.createdAt,
      })
      .from(collectionsTable)
      .innerJoin(photoCollectionsTable, eq(collectionsTable.id, photoCollectionsTable.collectionId))
      .where(eq(photoCollectionsTable.photoId, photoId)),
    db
      .select({
        averageRating: avg(ratingsTable.score),
        ratingCount: count(ratingsTable.id),
      })
      .from(ratingsTable)
      .where(eq(ratingsTable.photoId, photoId)),
    db
      .select({
        userId: ratingsTable.userId,
        userName: usersTable.name,
        score: ratingsTable.score,
        createdAt: ratingsTable.createdAt,
      })
      .from(ratingsTable)
      .leftJoin(usersTable, eq(ratingsTable.userId, usersTable.id))
      .where(eq(ratingsTable.photoId, photoId))
      .orderBy(ratingsTable.createdAt),
    db
      .select({ id: collectionsTable.id, title: collectionsTable.title })
      .from(photoCollectionSuggestionsTable)
      .innerJoin(collectionsTable, eq(photoCollectionSuggestionsTable.collectionId, collectionsTable.id))
      .where(
        and(
          eq(photoCollectionSuggestionsTable.photoId, photoId),
          eq(photoCollectionSuggestionsTable.status, "pending"),
        ),
      ),
    db
      .select({
        id: photoNewCollectionSuggestionsTable.id,
        suggestedName: photoNewCollectionSuggestionsTable.suggestedName,
      })
      .from(photoNewCollectionSuggestionsTable)
      .where(
        and(
          eq(photoNewCollectionSuggestionsTable.photoId, photoId),
          eq(photoNewCollectionSuggestionsTable.status, "pending"),
        ),
      ),
    db
      .select({ status: aiAnalysisEventsTable.status })
      .from(aiAnalysisEventsTable)
      .where(eq(aiAnalysisEventsTable.photoId, photoId))
      .orderBy(desc(aiAnalysisEventsTable.createdAt))
      .limit(1),
  ]);

  const ratingData = ratingDataArr[0];
  const latestAiStatus = latestAiEvents[0]?.status ?? null;

  let myRating: number | null = null;
  if (currentUserId) {
    const [myRatingRow] = await db
      .select({ score: ratingsTable.score })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.photoId, photoId), eq(ratingsTable.userId, currentUserId)));
    myRating = myRatingRow?.score ?? null;
  }

  const p = photo.photo;
  return {
    ...p,
    takenAt: p.takenAt instanceof Date ? p.takenAt.toISOString() : (p.takenAt ?? null),
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    albumTitle: photo.albumTitle ?? null,
    photoCollections: photoCollections.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description ?? null,
      createdById: c.createdById,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      photoCount: 0,
      coverPhotoUrl: null,
    })),
    averageRating: ratingData?.averageRating ? parseFloat(String(ratingData.averageRating)) : null,
    ratingCount: Number(ratingData?.ratingCount ?? 0),
    myRating,
    ratings: ratingsList.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? null,
      score: r.score,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
    suggestedCollections,
    suggestedNewCollections,
    latestAiStatus,
  };
}

export async function buildPhotosResponse(photoIds: number[], currentUserId?: number) {
  return Promise.all(photoIds.map((id) => buildPhotoResponse(id, currentUserId)));
}
