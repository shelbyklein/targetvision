import { db, photosTable, tagsTable, photoTagsTable, categoriesTable, photoCategoriesTable, ratingsTable, usersTable, albumsTable } from "@workspace/db";
import { eq, and, avg, count, sql } from "drizzle-orm";

export async function buildPhotoResponse(photoId: number, currentUserId?: number) {
  const [photo] = await db
    .select({
      photo: photosTable,
      albumTitle: albumsTable.title,
      uploaderName: usersTable.name,
    })
    .from(photosTable)
    .leftJoin(albumsTable, eq(photosTable.albumId, albumsTable.id))
    .leftJoin(usersTable, eq(photosTable.uploaderId, usersTable.id))
    .where(eq(photosTable.id, photoId));

  if (!photo) return null;

  const tags = await db
    .select({ id: tagsTable.id, name: tagsTable.name })
    .from(tagsTable)
    .innerJoin(photoTagsTable, eq(tagsTable.id, photoTagsTable.tagId))
    .where(eq(photoTagsTable.photoId, photoId));

  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .innerJoin(photoCategoriesTable, eq(categoriesTable.id, photoCategoriesTable.categoryId))
    .where(eq(photoCategoriesTable.photoId, photoId));

  const [ratingData] = await db
    .select({
      averageRating: avg(ratingsTable.score),
      ratingCount: count(ratingsTable.id),
    })
    .from(ratingsTable)
    .where(eq(ratingsTable.photoId, photoId));

  let myRating: number | null = null;
  if (currentUserId) {
    const [myRatingRow] = await db
      .select({ score: ratingsTable.score })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.photoId, photoId), eq(ratingsTable.userId, currentUserId)));
    myRating = myRatingRow?.score ?? null;
  }

  return {
    ...photo.photo,
    albumTitle: photo.albumTitle ?? null,
    uploaderName: photo.uploaderName ?? null,
    tags,
    categories,
    averageRating: ratingData?.averageRating ? parseFloat(String(ratingData.averageRating)) : null,
    ratingCount: Number(ratingData?.ratingCount ?? 0),
    myRating,
  };
}

export async function buildPhotosResponse(photoIds: number[], currentUserId?: number) {
  return Promise.all(photoIds.map((id) => buildPhotoResponse(id, currentUserId)));
}
