import { db, photosTable, tagsTable, photoTagsTable, categoriesTable, photoCategoriesTable, ratingsTable, usersTable, albumsTable, collectionsTable, photoCollectionsTable, photoCollectionSuggestionsTable, photoTagSuggestionsTable, photoCategorySuggestionsTable } from "@workspace/db";
import { eq, and, avg, count, sql } from "drizzle-orm";

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

  const [tags, categories, photoCollections, ratingDataArr, ratingsList, suggestedCollections, suggestedTags, suggestedCategories] = await Promise.all([
    db
      .select({ id: tagsTable.id, name: tagsTable.name })
      .from(tagsTable)
      .innerJoin(photoTagsTable, eq(tagsTable.id, photoTagsTable.tagId))
      .where(eq(photoTagsTable.photoId, photoId)),
    db
      .select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(categoriesTable)
      .innerJoin(photoCategoriesTable, eq(categoriesTable.id, photoCategoriesTable.categoryId))
      .where(eq(photoCategoriesTable.photoId, photoId)),
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
      .select({ name: photoTagSuggestionsTable.tagName })
      .from(photoTagSuggestionsTable)
      .where(
        and(
          eq(photoTagSuggestionsTable.photoId, photoId),
          eq(photoTagSuggestionsTable.status, "pending"),
        ),
      ),
    db
      .select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(photoCategorySuggestionsTable)
      .innerJoin(categoriesTable, eq(photoCategorySuggestionsTable.categoryId, categoriesTable.id))
      .where(
        and(
          eq(photoCategorySuggestionsTable.photoId, photoId),
          eq(photoCategorySuggestionsTable.status, "pending"),
        ),
      ),
  ]);

  const ratingData = ratingDataArr[0];

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
    tags,
    categories,
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
    suggestedTags,
    suggestedCategories,
  };
}

export async function buildPhotosResponse(photoIds: number[], currentUserId?: number) {
  return Promise.all(photoIds.map((id) => buildPhotoResponse(id, currentUserId)));
}
