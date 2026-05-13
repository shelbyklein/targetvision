import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, photosTable, ratingsTable, albumsTable, collectionsTable, photoCollectionsTable, photoCollectionSuggestionsTable, photoNewCollectionSuggestionsTable } from "@workspace/db";
import { runAndRecordPhotoAnalysis } from "../lib/aiPhotoAnalysis";
import { generateAndStoreThumbnail } from "../lib/thumbnailGeneration";
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
  RatePhotoParams,
  RatePhotoBody,
  RatePhotoResponse,
  ClearPhotoRatingParams,
  ClearPhotoRatingResponse,
  AcceptPhotoSuggestionParams,
  AcceptPhotoSuggestionResponse,
  DismissPhotoSuggestionParams,
  DismissPhotoSuggestionResponse,
  AcceptPhotoNewCollectionSuggestionParams,
  AcceptPhotoNewCollectionSuggestionResponse,
  DismissPhotoNewCollectionSuggestionParams,
  DismissPhotoNewCollectionSuggestionResponse,
  RerunPhotoAnalysisParams,
  RerunPhotoAnalysisResponse,
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
      storageKey: body.data.storageKey,
      takenAt: body.data.takenAt ? new Date(body.data.takenAt) : null,
    })
    .returning();

  void runAndRecordPhotoAnalysis(photo.id).catch((err) => {
    logger.error({ err, photoId: photo.id }, "Background AI analysis failed");
  });

  if (photo.storageKey) {
    void generateAndStoreThumbnail(photo.id, photo.storageKey).catch((err) => {
      logger.error({ err, photoId: photo.id }, "Background thumbnail generation failed");
    });
  }

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
  const { search, tag, categoryId, ratingMin, ratingMax, dateFrom, dateTo, uploaderId } = query.data;

  const filteredIds = await applyFiltersAndFetchIds(allIds, {
    search,
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

router.post("/photos/:id/new-collection-suggestions/:suggestionId/accept", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawSid = Array.isArray(req.params.suggestionId) ? req.params.suggestionId[0] : req.params.suggestionId;
  const params = AcceptPhotoNewCollectionSuggestionParams.safeParse({
    id: parseInt(rawId, 10),
    suggestionId: parseInt(rawSid, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db
    .select({ id: photosTable.id, uploaderId: photosTable.uploaderId })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const isAdmin = req.dbUser!.role === "admin";
  const isOwner = photoExists.uploaderId === req.dbUser!.id;
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [suggestion] = await db
    .select()
    .from(photoNewCollectionSuggestionsTable)
    .where(
      and(
        eq(photoNewCollectionSuggestionsTable.id, params.data.suggestionId),
        eq(photoNewCollectionSuggestionsTable.photoId, params.data.id),
        eq(photoNewCollectionSuggestionsTable.status, "pending"),
      ),
    );
  if (!suggestion) {
    res.status(404).json({ error: "Pending suggestion not found" });
    return;
  }

  const [newCollection] = await db
    .insert(collectionsTable)
    .values({
      title: suggestion.suggestedName,
      createdById: photoExists.uploaderId,
    })
    .returning();

  await db
    .insert(photoCollectionsTable)
    .values({ collectionId: newCollection.id, photoId: params.data.id })
    .onConflictDoNothing();

  await db
    .update(photoNewCollectionSuggestionsTable)
    .set({ status: "accepted" })
    .where(eq(photoNewCollectionSuggestionsTable.id, params.data.suggestionId));

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(AcceptPhotoNewCollectionSuggestionResponse.parse(full));
});

router.post("/photos/:id/new-collection-suggestions/:suggestionId/dismiss", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawSid = Array.isArray(req.params.suggestionId) ? req.params.suggestionId[0] : req.params.suggestionId;
  const params = DismissPhotoNewCollectionSuggestionParams.safeParse({
    id: parseInt(rawId, 10),
    suggestionId: parseInt(rawSid, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photoExists] = await db
    .select({ id: photosTable.id, uploaderId: photosTable.uploaderId })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));
  if (!photoExists) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const isAdmin = req.dbUser!.role === "admin";
  const isOwner = photoExists.uploaderId === req.dbUser!.id;
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [suggestion] = await db
    .select({ id: photoNewCollectionSuggestionsTable.id })
    .from(photoNewCollectionSuggestionsTable)
    .where(
      and(
        eq(photoNewCollectionSuggestionsTable.id, params.data.suggestionId),
        eq(photoNewCollectionSuggestionsTable.photoId, params.data.id),
        eq(photoNewCollectionSuggestionsTable.status, "pending"),
      ),
    );
  if (!suggestion) {
    res.status(404).json({ error: "Pending suggestion not found" });
    return;
  }

  await db
    .update(photoNewCollectionSuggestionsTable)
    .set({ status: "dismissed" })
    .where(eq(photoNewCollectionSuggestionsTable.id, params.data.suggestionId));

  const full = await buildPhotoResponse(params.data.id, req.dbUser?.id);
  res.json(DismissPhotoNewCollectionSuggestionResponse.parse(full));
});

router.post("/photos/:id/rerun-analysis", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RerunPhotoAnalysisParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: photosTable.id, uploaderId: photosTable.uploaderId })
    .from(photosTable)
    .where(eq(photosTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const isAdmin = req.dbUser!.role === "admin";
  const isUploader = existing.uploaderId === req.dbUser!.id;
  if (!isAdmin && !isUploader) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const event = await runAndRecordPhotoAnalysis(params.data.id);
  if (!event) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  res.json(RerunPhotoAnalysisResponse.parse(event));
});

export default router;
