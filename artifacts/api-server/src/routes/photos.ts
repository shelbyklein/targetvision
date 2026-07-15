import { Router, type IRouter } from "express";
import { eq, and, inArray, desc, ne, sql } from "drizzle-orm";
import { db, photosTable, ratingsTable, albumsTable, collectionsTable, photoCollectionsTable, photoCollectionSuggestionsTable, photoNewCollectionSuggestionsTable, photoEmbeddingsTable } from "@workspace/db";
import { runAndRecordPhotoAnalysis } from "../lib/aiPhotoAnalysis";
import { generateAndStorePhotoEmbedding } from "../lib/aiEmbedding";
import { generateAndStoreThumbnail } from "../lib/thumbnailGeneration";
import { computeAndStoreContentHash } from "../lib/contentHash";
import { computeAndStorePerceptualHash } from "../lib/perceptualHash";
import { optimizeOriginalImage } from "../lib/imageOptimization";
import { ObjectStorageService } from "../lib/objectStorage";
import { readMagicBytes, detectImageMimeType } from "../lib/magicBytes";
import { logger } from "../lib/logger";
import {
  ListAlbumPhotosParams,
  ListAlbumPhotosPagedResponse,
  UploadPhotoParams,
  UploadPhotoBody,
  CheckDuplicatesBody,
  CheckDuplicatesResponse,
  ListPhotosQueryParams,
  ListPhotosResponse,
  GetPhotoParams,
  GetPhotoResponse,
  ListSimilarPhotosResponse,
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
  AcceptPhotoNewCollectionSuggestionBody,
  AcceptPhotoNewCollectionSuggestionResponse,
  DismissPhotoNewCollectionSuggestionParams,
  DismissPhotoNewCollectionSuggestionResponse,
  RerunPhotoAnalysisParams,
  RerunPhotoAnalysisResponse,
  BulkUpdatePhotosBody,
  BulkUpdatePhotosResponse,
  BulkDeletePhotosBody,
  BulkDeletePhotosResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotoResponse, buildPhotosResponse, fetchAlbumPhotoPage, deletePhotoStorageObjects } from "../lib/photoHelpers";
import { applyFiltersAndFetchIds } from "./search";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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

  let mimeType: string | null = null;
  if (body.data.storageKey) {
    let objectFile;
    try {
      objectFile = await objectStorageService.getObjectEntityFile(body.data.storageKey);
      const [metadata] = await objectFile.getMetadata();
      mimeType = (metadata.contentType as string) || null;
    } catch {
      res.status(400).json({ error: "Unable to verify uploaded file type" });
      return;
    }

    try {
      const magicBuf = await readMagicBytes(objectFile);
      const detectedType = detectImageMimeType(magicBuf);
      if (!detectedType) {
        await objectFile.delete().catch((err) => {
          logger.error({ err, storageKey: body.data.storageKey }, "Failed to delete rejected upload");
        });
        res.status(400).json({ error: "File content does not match a supported image type (JPEG, PNG, GIF, WebP)" });
        return;
      }
      if (mimeType && detectedType !== mimeType) {
        await objectFile.delete().catch((err) => {
          logger.error({ err, storageKey: body.data.storageKey }, "Failed to delete rejected upload");
        });
        res.status(400).json({ error: `File content (${detectedType}) does not match the claimed type (${mimeType})` });
        return;
      }
      mimeType = detectedType;
    } catch (err) {
      logger.error({ err, storageKey: body.data.storageKey }, "Magic byte check failed");
      res.status(400).json({ error: "Unable to verify file content" });
      return;
    }
  } else {
    mimeType = body.data.contentType ?? null;
  }

  if (!mimeType || !mimeType.startsWith("image/")) {
    res.status(400).json({ error: "Only image files are allowed" });
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
      filename: body.data.filename ?? null,
      filesize: body.data.filesize ?? null,
    })
    .returning();

  void runAndRecordPhotoAnalysis(photo.id).catch((err) => {
    logger.error({ err, photoId: photo.id }, "Background AI analysis failed");
  });

  if (photo.storageKey) {
    const storageKey = photo.storageKey;
    // Optimize the original to WebP first (in place — storageKey stays valid),
    // then derive everything else from the final bytes. runs regardless of
    // whether optimization succeeds/skips/fails.
    void optimizeOriginalImage(photo.id, storageKey)
      .catch((err) => logger.error({ err, photoId: photo.id }, "Image optimization failed"))
      .finally(() => {
        void generateAndStoreThumbnail(photo.id, storageKey).catch((err) => {
          logger.error({ err, photoId: photo.id }, "Background thumbnail generation failed");
        });
        void computeAndStoreContentHash(photo.id, storageKey).catch((err) => {
          logger.error({ err, photoId: photo.id }, "Background content hash computation failed");
        });
        void computeAndStorePerceptualHash(photo.id, storageKey).catch((err) => {
          logger.error({ err, photoId: photo.id }, "Background perceptual hash computation failed");
        });
        // No-ops unless image embeddings are enabled + Vertex is configured.
        void generateAndStorePhotoEmbedding(photo.id).catch((err) => {
          logger.error({ err, photoId: photo.id }, "Background embedding generation failed");
        });
      });
  }

  const full = await buildPhotoResponse(photo.id, req.dbUser?.id);
  res.status(201).json(GetPhotoResponse.parse(full));
});

router.post("/albums/:id/photos/check-duplicates", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UploadPhotoParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CheckDuplicatesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [album] = await db.select({ id: albumsTable.id }).from(albumsTable).where(eq(albumsTable.id, params.data.id));
  if (!album) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  const existing = await db
    .select({ id: photosTable.id, filename: photosTable.filename, filesize: photosTable.filesize })
    .from(photosTable)
    .where(eq(photosTable.albumId, params.data.id));

  const duplicates = body.data.files
    .map((f) => {
      const match = existing.find(
        (p) => p.filename === f.name && p.filesize === f.size
      );
      return match ? { name: f.name, size: f.size, photoId: match.id } : null;
    })
    .filter(Boolean) as Array<{ name: string; size: number; photoId: number }>;

  res.json(CheckDuplicatesResponse.parse({ duplicates }));
});

router.get("/albums/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListAlbumPhotosParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const includeHidden = req.query.includeHidden === "true";
  const canSeeHidden = req.dbUser!.role === "admin" && includeHidden;

  const DEFAULT_LIMIT = 50;
  const MAX_LIMIT = 200;
  const rawLimit = req.query.limit !== undefined ? parseInt(req.query.limit as string, 10) : undefined;
  const rawOffset = req.query.offset !== undefined ? parseInt(req.query.offset as string, 10) : 0;
  const limit = rawLimit !== undefined && !isNaN(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = !isNaN(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const inCollectionStr = req.query.inCollection;
  const inCollection = inCollectionStr === "true" ? true : inCollectionStr === "false" ? false : undefined;
  const hasRatingStr = req.query.hasRating;
  const hasRating = hasRatingStr === "true" ? true : hasRatingStr === "false" ? false : undefined;
  const aiStatusRaw = typeof req.query.aiStatus === "string" ? req.query.aiStatus : undefined;
  const aiStatus =
    aiStatusRaw === "has_description" || aiStatusRaw === "failed" || aiStatusRaw === "not_analysed"
      ? aiStatusRaw
      : undefined;

  // Filter and paginate entirely in SQL: only the requested page of photo IDs
  // leaves the database, and only that page is expanded into full responses.
  const { ids: pageIds, hasMore } = await fetchAlbumPhotoPage(params.data.id, {
    canSeeHidden,
    inCollection,
    hasRating,
    aiStatus,
    limit,
    offset,
  });

  const photoList = await buildPhotosResponse(pageIds, req.dbUser?.id);
  res.json(ListAlbumPhotosPagedResponse.parse({ photos: photoList, hasMore }));
});

router.get("/photos", requireAuth, async (req, res): Promise<void> => {
  const query = ListPhotosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const includeHidden = req.query.includeHidden === "true";
  const canSeeHidden = req.dbUser!.role === "admin" && includeHidden;

  const allPhotos = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .where(canSeeHidden ? undefined : eq(photosTable.isHidden, false))
    .orderBy(desc(photosTable.createdAt));

  const allIds = allPhotos.map((p) => p.id);
  const { search, tag, categoryId, ratingMin, ratingMax, dateFrom, dateTo, uploaderId, albumId, aiStatus } = query.data;

  const filteredIds = await applyFiltersAndFetchIds(allIds, {
    search,
    tag,
    categoryId,
    ratingMin,
    ratingMax,
    dateFrom,
    dateTo,
    uploaderId,
    albumId,
    aiStatus,
  });

  const full = await buildPhotosResponse(filteredIds, req.dbUser?.id);
  res.json(ListPhotosResponse.parse(full));
});

router.patch("/photos/bulk", requireAuth, async (req, res): Promise<void> => {
  if (req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = BulkUpdatePhotosBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { ids, isHidden } = body.data;

  const updated = await db
    .update(photosTable)
    .set({ isHidden })
    .where(inArray(photosTable.id, ids))
    .returning({ id: photosTable.id });

  res.json(BulkUpdatePhotosResponse.parse({ updated: updated.length }));
});

router.delete("/photos/bulk", requireAuth, async (req, res): Promise<void> => {
  if (req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = BulkDeletePhotosBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { ids } = body.data;

  const toDelete = await db
    .select({ id: photosTable.id, storageKey: photosTable.storageKey, thumbnailKey: photosTable.thumbnailKey })
    .from(photosTable)
    .where(inArray(photosTable.id, ids));

  const deleted = await db
    .delete(photosTable)
    .where(inArray(photosTable.id, ids))
    .returning({ id: photosTable.id });

  await Promise.all(toDelete.map((photo) => deletePhotoStorageObjects(photo)));

  res.json(BulkDeletePhotosResponse.parse({ deleted: deleted.length }));
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
  if (body.data.isHidden !== undefined) updateData.isHidden = body.data.isHidden;

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
  await deletePhotoStorageObjects(existing);
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

  const body = AcceptPhotoNewCollectionSuggestionBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const collectionTitle = body.data.name?.trim() || suggestion.suggestedName;

  const [newCollection] = await db
    .insert(collectionsTable)
    .values({
      title: collectionTitle,
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

router.get("/photos/:id/similar", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid photo ID" });
    return;
  }
  const topKRaw = req.query.topK ? parseInt(String(req.query.topK), 10) : 12;
  const topK = Number.isInteger(topKRaw) && topKRaw > 0 ? Math.min(topKRaw, 50) : 12;

  // This photo's own embedding — empty result if it hasn't been embedded yet.
  const [self] = await db
    .select({ embedding: photoEmbeddingsTable.embedding })
    .from(photoEmbeddingsTable)
    .where(eq(photoEmbeddingsTable.photoId, id));
  if (!self) {
    res.json(ListSimilarPhotosResponse.parse([]));
    return;
  }
  const vecLiteral = `[${self.embedding.join(",")}]`;

  const canSeeHidden = req.dbUser!.role === "admin";
  const rows = await db
    .select({ id: photoEmbeddingsTable.photoId })
    .from(photoEmbeddingsTable)
    .innerJoin(photosTable, eq(photosTable.id, photoEmbeddingsTable.photoId))
    .where(
      and(
        ne(photoEmbeddingsTable.photoId, id),
        canSeeHidden ? undefined : eq(photosTable.isHidden, false),
      ),
    )
    .orderBy(sql`${photoEmbeddingsTable.embedding} <=> ${vecLiteral}::vector`)
    .limit(topK);

  const photos = await buildPhotosResponse(rows.map((r) => r.id), req.dbUser?.id);
  res.json(ListSimilarPhotosResponse.parse(photos));
});

export default router;
