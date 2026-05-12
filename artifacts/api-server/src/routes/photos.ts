import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, photosTable, tagsTable, photoTagsTable, categoriesTable, photoCategoriesTable, ratingsTable, albumsTable, usersTable, collectionsTable, photoCollectionsTable, photoCollectionSuggestionsTable, photoTagSuggestionsTable } from "@workspace/db";
import { analyzePhoto } from "../lib/aiPhotoAnalysis";
import { logger } from "../lib/logger";
import {
  ListAlbumPhotosParams,
  ListAlbumPhotosResponse,
  UploadPhotoParams,
  UploadPhotoBody,
  ListPhotosQueryParams,
  ListPhotosResponse,
  GetPhotoParams,
  GetPhotoResponse,
  UpdatePhotoParams,
  UpdatePhotoBody,
  UpdatePhotoResponse,
  DeletePhotoParams,
  AddPhotoTagParams,
  AddPhotoTagBody,
  AddPhotoTagResponse,
  RemovePhotoTagParams,
  RemovePhotoTagResponse,
  AddPhotoCategoryParams,
  AddPhotoCategoryBody,
  AddPhotoCategoryResponse,
  RemovePhotoCategoryParams,
  RemovePhotoCategoryResponse,
  RatePhotoParams,
  RatePhotoBody,
  RatePhotoResponse,
  ClearPhotoRatingParams,
  ClearPhotoRatingResponse,
  AcceptPhotoSuggestionParams,
  AcceptPhotoSuggestionResponse,
  DismissPhotoSuggestionParams,
  DismissPhotoSuggestionResponse,
  AcceptPhotoTagSuggestionParams,
  AcceptPhotoTagSuggestionResponse,
  DismissPhotoTagSuggestionParams,
  DismissPhotoTagSuggestionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotoResponse } from "../lib/photoHelpers";
import { applyFiltersAndFetchIds } from "./search";

const router: IRouter = Router();

router.post("/albums/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UploadPhotoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UploadPhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [album] = await db.select().from(albumsTable).where(eq(albumsTable.id, params.data.id));
  if (!album) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  const [photo] = await db
    .insert(photosTable)
    .values({
      albumId: params.data.id,
      uploaderId: req.dbUser!.id,
      url: body.data.url,
      caption: body.data.caption,
      storageKey: body.data.storageKey,
      takenAt: body.data.takenAt ? new Date(body.data.takenAt) : null,
    })
    .returning();

  // Fire-and-forget AI analysis. Failures are swallowed so the upload still succeeds.
  void (async () => {
    try {
      const collections = await db
        .select({
          id: collectionsTable.id,
          title: collectionsTable.title,
          description: collectionsTable.description,
        })
        .from(collectionsTable)
        .where(eq(collectionsTable.createdById, req.dbUser!.id));

      const result = await analyzePhoto(photo.url, collections, photo.storageKey);
      if (!result) return;

      await db
        .update(photosTable)
        .set({ aiDescription: result.description || null })
        .where(eq(photosTable.id, photo.id));

      if (result.suggestedCollectionIds.length > 0) {
        await db
          .insert(photoCollectionSuggestionsTable)
          .values(
            result.suggestedCollectionIds.map((cid) => ({
              photoId: photo.id,
              collectionId: cid,
              status: "pending" as const,
            })),
          )
          .onConflictDoNothing();
      }

      if (result.suggestedTags.length > 0) {
        const existingTags = await db
          .select({ name: tagsTable.name })
          .from(tagsTable)
          .innerJoin(photoTagsTable, eq(tagsTable.id, photoTagsTable.tagId))
          .where(eq(photoTagsTable.photoId, photo.id));
        const existingNames = new Set(existingTags.map((t) => t.name));
        const newSuggestions = result.suggestedTags.filter((t) => !existingNames.has(t));

        if (newSuggestions.length > 0) {
          await db
            .insert(photoTagSuggestionsTable)
            .values(
              newSuggestions.map((tagName) => ({
                photoId: photo.id,
                tagName,
                status: "pending" as const,
              })),
            )
            .onConflictDoNothing();
        }
      }
    } catch (err) {
      logger.error({ err, photoId: photo.id }, "Background AI analysis failed");
    }
  })();

  const full = await buildPhotoResponse(photo.id, req.dbUser?.id);
  res.status(201).json(GetPhotoResponse.parse(full));
});

router.get("/albums/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListAlbumPhotosParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const photos = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(eq(photosTable.albumId, params.data.id))
    .orderBy(photosTable.createdAt);

  const full = await Promise.all(photos.map((p) => buildPhotoResponse(p.id, req.dbUser?.id)));
  res.json(ListAlbumPhotosResponse.parse(full.filter(Boolean)));
});

router.get("/photos", requireAuth, async (req, res): Promise<void> => {
  const query = ListPhotosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const allPhotos = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .orderBy(photosTable.createdAt);

  const allIds = allPhotos.map((p) => p.id);
  const { tag, categoryId, ratingMin, ratingMax, dateFrom, dateTo, uploaderId } = query.data;

  const filteredIds = await applyFiltersAndFetchIds(allIds, {
    tag,
    categoryId,
    ratingMin,
    ratingMax,
    dateFrom,
    dateTo,
    uploaderId,
  });

  const full = await Promise.all(filteredIds.map((id) => buildPhotoResponse(id, req.dbUser?.id)));
  res.json(ListPhotosResponse.parse(full.filter(Boolean)));
});

router.get("/photos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPhotoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const photo = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  res.json(GetPhotoResponse.parse(photo));
});

router.patch("/photos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePhotoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdatePhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  if (existing.uploaderId !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.caption !== undefined) updateData.caption = body.data.caption;
  if (body.data.aiDescription !== undefined) updateData.aiDescription = body.data.aiDescription;
  if (body.data.takenAt !== undefined) updateData.takenAt = body.data.takenAt ? new Date(body.data.takenAt) : null;

  if (Object.keys(updateData).length > 0) {
    await db.update(photosTable).set(updateData).where(eq(photosTable.id, params.data.id));
  }

  const photo = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(UpdatePhotoResponse.parse(photo));
});

router.delete("/photos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePhotoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  if (existing.uploaderId !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(photosTable).where(eq(photosTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/photos/:id/tags", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddPhotoTagParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AddPhotoTagBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  let [tag] = await db.select().from(tagsTable).where(eq(tagsTable.name, body.data.tagName));
  if (!tag) {
    [tag] = await db.insert(tagsTable).values({ name: body.data.tagName }).returning();
  }

  await db
    .insert(photoTagsTable)
    .values({ photoId: params.data.id, tagId: tag.id })
    .onConflictDoNothing();

  const photo = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(AddPhotoTagResponse.parse(photo));
});

router.delete("/photos/:id/tags/:tagId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawTagId = Array.isArray(req.params.tagId) ? req.params.tagId[0] : req.params.tagId;
  const params = RemovePhotoTagParams.safeParse({ id: parseInt(rawId, 10), tagId: parseInt(rawTagId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .delete(photoTagsTable)
    .where(and(eq(photoTagsTable.photoId, params.data.id), eq(photoTagsTable.tagId, params.data.tagId)));

  const photo = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(RemovePhotoTagResponse.parse(photo));
});

router.post("/photos/:id/categories", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddPhotoCategoryParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AddPhotoCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const [catExists] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, body.data.categoryId));
  if (!catExists) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  await db
    .insert(photoCategoriesTable)
    .values({ photoId: params.data.id, categoryId: body.data.categoryId })
    .onConflictDoNothing();

  const photo = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(AddPhotoCategoryResponse.parse(photo));
});

router.delete("/photos/:id/categories/:categoryId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawCatId = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const params = RemovePhotoCategoryParams.safeParse({ id: parseInt(rawId, 10), categoryId: parseInt(rawCatId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .delete(photoCategoriesTable)
    .where(and(eq(photoCategoriesTable.photoId, params.data.id), eq(photoCategoriesTable.categoryId, params.data.categoryId)));

  const photo = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(RemovePhotoCategoryResponse.parse(photo));
});

router.post("/photos/:id/rating", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RatePhotoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RatePhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [photo] = await db.select().from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .insert(ratingsTable)
    .values({ photoId: params.data.id, userId: req.dbUser!.id, score: body.data.score })
    .onConflictDoUpdate({
      target: [ratingsTable.photoId, ratingsTable.userId],
      set: { score: body.data.score },
    });

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(RatePhotoResponse.parse(full));
});

router.delete("/photos/:id/rating", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ClearPhotoRatingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photo] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .delete(ratingsTable)
    .where(and(eq(ratingsTable.photoId, params.data.id), eq(ratingsTable.userId, req.dbUser!.id)));

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(ClearPhotoRatingResponse.parse(full));
});

router.post("/photos/:id/suggestions/:collectionId/accept", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawCol = Array.isArray(req.params.collectionId) ? req.params.collectionId[0] : req.params.collectionId;
  const params = AcceptPhotoSuggestionParams.safeParse({
    id: parseInt(rawId, 10),
    collectionId: parseInt(rawCol, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id, uploaderId: photosTable.uploaderId }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const [collection] = await db.select({ id: collectionsTable.id, createdById: collectionsTable.createdById }).from(collectionsTable).where(eq(collectionsTable.id, params.data.collectionId));
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const isAdmin = req.dbUser!.role === "admin";
  const isOwner = photoExists.uploaderId === req.dbUser!.id || collection.createdById === req.dbUser!.id;
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [suggestion] = await db
    .select({ status: photoCollectionSuggestionsTable.status })
    .from(photoCollectionSuggestionsTable)
    .where(
      and(
        eq(photoCollectionSuggestionsTable.photoId, params.data.id),
        eq(photoCollectionSuggestionsTable.collectionId, params.data.collectionId),
      ),
    );
  if (!suggestion || suggestion.status !== "pending") {
    res.status(404).json({ error: "Pending suggestion not found" });
    return;
  }

  await db
    .insert(photoCollectionsTable)
    .values({ collectionId: params.data.collectionId, photoId: params.data.id })
    .onConflictDoNothing();

  await db
    .update(photoCollectionSuggestionsTable)
    .set({ status: "accepted" })
    .where(
      and(
        eq(photoCollectionSuggestionsTable.photoId, params.data.id),
        eq(photoCollectionSuggestionsTable.collectionId, params.data.collectionId),
      ),
    );

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(AcceptPhotoSuggestionResponse.parse(full));
});

router.post("/photos/:id/suggestions/:collectionId/dismiss", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawCol = Array.isArray(req.params.collectionId) ? req.params.collectionId[0] : req.params.collectionId;
  const params = DismissPhotoSuggestionParams.safeParse({
    id: parseInt(rawId, 10),
    collectionId: parseInt(rawCol, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id, uploaderId: photosTable.uploaderId }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const [collection] = await db.select({ createdById: collectionsTable.createdById }).from(collectionsTable).where(eq(collectionsTable.id, params.data.collectionId));
  const isAdmin = req.dbUser!.role === "admin";
  const isOwner = photoExists.uploaderId === req.dbUser!.id || (collection && collection.createdById === req.dbUser!.id);
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [existing] = await db
    .select({ status: photoCollectionSuggestionsTable.status })
    .from(photoCollectionSuggestionsTable)
    .where(
      and(
        eq(photoCollectionSuggestionsTable.photoId, params.data.id),
        eq(photoCollectionSuggestionsTable.collectionId, params.data.collectionId),
      ),
    );
  if (!existing || existing.status !== "pending") {
    res.status(404).json({ error: "Pending suggestion not found" });
    return;
  }

  await db
    .update(photoCollectionSuggestionsTable)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(photoCollectionSuggestionsTable.photoId, params.data.id),
        eq(photoCollectionSuggestionsTable.collectionId, params.data.collectionId),
      ),
    );

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(DismissPhotoSuggestionResponse.parse(full));
});

router.post("/photos/:id/tag-suggestions/:tagName/accept", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawTag = Array.isArray(req.params.tagName) ? req.params.tagName[0] : req.params.tagName;
  const params = AcceptPhotoTagSuggestionParams.safeParse({
    id: parseInt(rawId, 10),
    tagName: rawTag,
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const tagName = params.data.tagName.trim().toLowerCase();

  const [suggestion] = await db
    .select({ status: photoTagSuggestionsTable.status })
    .from(photoTagSuggestionsTable)
    .where(
      and(
        eq(photoTagSuggestionsTable.photoId, params.data.id),
        eq(photoTagSuggestionsTable.tagName, tagName),
      ),
    );
  if (!suggestion || suggestion.status !== "pending") {
    res.status(404).json({ error: "Pending suggestion not found" });
    return;
  }

  let [tag] = await db.select().from(tagsTable).where(eq(tagsTable.name, tagName));
  if (!tag) {
    [tag] = await db.insert(tagsTable).values({ name: tagName }).returning();
  }

  await db
    .insert(photoTagsTable)
    .values({ photoId: params.data.id, tagId: tag.id })
    .onConflictDoNothing();

  await db
    .update(photoTagSuggestionsTable)
    .set({ status: "accepted" })
    .where(
      and(
        eq(photoTagSuggestionsTable.photoId, params.data.id),
        eq(photoTagSuggestionsTable.tagName, tagName),
      ),
    );

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(AcceptPhotoTagSuggestionResponse.parse(full));
});

router.post("/photos/:id/tag-suggestions/:tagName/dismiss", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawTag = Array.isArray(req.params.tagName) ? req.params.tagName[0] : req.params.tagName;
  const params = DismissPhotoTagSuggestionParams.safeParse({
    id: parseInt(rawId, 10),
    tagName: rawTag,
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const tagName = params.data.tagName.trim().toLowerCase();

  const [existing] = await db
    .select({ status: photoTagSuggestionsTable.status })
    .from(photoTagSuggestionsTable)
    .where(
      and(
        eq(photoTagSuggestionsTable.photoId, params.data.id),
        eq(photoTagSuggestionsTable.tagName, tagName),
      ),
    );
  if (!existing || existing.status !== "pending") {
    res.status(404).json({ error: "Pending suggestion not found" });
    return;
  }

  await db
    .update(photoTagSuggestionsTable)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(photoTagSuggestionsTable.photoId, params.data.id),
        eq(photoTagSuggestionsTable.tagName, tagName),
      ),
    );

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(DismissPhotoTagSuggestionResponse.parse(full));
});

export default router;
