import { Router, type IRouter } from "express";
import { eq, count, sql, and } from "drizzle-orm";
import { db, collectionsTable, photoCollectionsTable, photosTable, collectionTagsTable, tagsTable } from "@workspace/db";
import {
  ListCollectionsResponse,
  CreateCollectionBody,
  GetCollectionParams,
  GetCollectionResponse,
  UpdateCollectionParams,
  UpdateCollectionBody,
  UpdateCollectionResponse,
  DeleteCollectionParams,
  AddPhotoToCollectionParams,
  AddPhotoToCollectionBody,
  RemovePhotoFromCollectionParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotoResponse } from "../lib/photoHelpers";

const router: IRouter = Router();

async function getCollectionTags(collectionId: number): Promise<string[]> {
  const rows = await db
    .select({ name: tagsTable.name })
    .from(collectionTagsTable)
    .innerJoin(tagsTable, eq(collectionTagsTable.tagId, tagsTable.id))
    .where(eq(collectionTagsTable.collectionId, collectionId))
    .orderBy(tagsTable.name);
  return rows.map((r) => r.name);
}

async function buildCollectionResponse(collectionId: number) {
  const [row] = await db
    .select({
      collection: collectionsTable,
      photoCount: count(photoCollectionsTable.photoId),
    })
    .from(collectionsTable)
    .leftJoin(photoCollectionsTable, eq(collectionsTable.id, photoCollectionsTable.collectionId))
    .where(eq(collectionsTable.id, collectionId))
    .groupBy(collectionsTable.id);

  if (!row) return null;

  const [coverPhotoRow, tags] = await Promise.all([
    row.collection.coverPhotoId
      ? db
          .select({ url: photosTable.url })
          .from(photosTable)
          .where(eq(photosTable.id, row.collection.coverPhotoId))
          .limit(1)
      : db
          .select({ url: photosTable.url })
          .from(photoCollectionsTable)
          .innerJoin(photosTable, eq(photoCollectionsTable.photoId, photosTable.id))
          .where(eq(photoCollectionsTable.collectionId, collectionId))
          .orderBy(sql`${photoCollectionsTable.photoId} asc`)
          .limit(1),
    getCollectionTags(collectionId),
  ]);

  return {
    ...row.collection,
    createdAt: row.collection.createdAt.toISOString(),
    photoCount: Number(row.photoCount),
    coverPhotoUrl: coverPhotoRow[0]?.url ?? null,
    tags,
  };
}

router.get("/collections", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      collection: collectionsTable,
      photoCount: count(photoCollectionsTable.photoId),
    })
    .from(collectionsTable)
    .leftJoin(photoCollectionsTable, eq(collectionsTable.id, photoCollectionsTable.collectionId))
    .groupBy(collectionsTable.id)
    .orderBy(sql`${collectionsTable.createdAt} desc`);

  const collections = await Promise.all(
    rows.map(async (row) => {
      const [coverPhotoRow, tags] = await Promise.all([
        row.collection.coverPhotoId
          ? db
              .select({ url: photosTable.url, thumbnailKey: photosTable.thumbnailKey })
              .from(photosTable)
              .where(eq(photosTable.id, row.collection.coverPhotoId))
              .limit(1)
          : db
              .select({ url: photosTable.url, thumbnailKey: photosTable.thumbnailKey })
              .from(photoCollectionsTable)
              .innerJoin(photosTable, eq(photoCollectionsTable.photoId, photosTable.id))
              .where(eq(photoCollectionsTable.collectionId, row.collection.id))
              .orderBy(sql`${photoCollectionsTable.photoId} asc`)
              .limit(1),
        getCollectionTags(row.collection.id),
      ]);

      return {
        ...row.collection,
        createdAt: row.collection.createdAt.toISOString(),
        photoCount: Number(row.photoCount),
        coverPhotoUrl: coverPhotoRow[0]?.url ?? null,
        coverPhotoThumbnailKey: coverPhotoRow[0]?.thumbnailKey ?? null,
        tags,
      };
    })
  );

  res.json(ListCollectionsResponse.parse(collections));
});

router.post("/collections", requireAuth, async (req, res): Promise<void> => {
  const body = CreateCollectionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [collection] = await db
    .insert(collectionsTable)
    .values({ ...body.data, createdById: req.dbUser!.id })
    .returning();

  const full = await buildCollectionResponse(collection.id);
  res.status(201).json(GetCollectionResponse.parse(full));
});

router.get("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCollectionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const full = await buildCollectionResponse(params.data.id);
  if (!full) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const photoRows = await db
    .select({ id: photoCollectionsTable.photoId })
    .from(photoCollectionsTable)
    .where(eq(photoCollectionsTable.collectionId, params.data.id))
    .orderBy(photoCollectionsTable.photoId);

  const photos = await Promise.all(
    photoRows.map((p) => buildPhotoResponse(p.id, req.dbUser?.id))
  );

  res.json(GetCollectionResponse.parse({ ...full, photos: photos.filter(Boolean) }));
});

router.patch("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateCollectionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateCollectionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(collectionsTable).where(eq(collectionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  if (existing.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.update(collectionsTable).set(body.data).where(eq(collectionsTable.id, params.data.id));
  const full = await buildCollectionResponse(params.data.id);
  res.json(UpdateCollectionResponse.parse(full));
});

router.delete("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCollectionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(collectionsTable).where(eq(collectionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  if (existing.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(collectionsTable).where(eq(collectionsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/collections/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddPhotoToCollectionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AddPhotoToCollectionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [collection] = await db.select().from(collectionsTable).where(eq(collectionsTable.id, params.data.id));
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const [photo] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, body.data.photoId));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .insert(photoCollectionsTable)
    .values({ collectionId: params.data.id, photoId: body.data.photoId })
    .onConflictDoNothing();

  res.sendStatus(204);
});

router.delete("/collections/:id/photos/:photoId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawPhotoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
  const params = RemovePhotoFromCollectionParams.safeParse({
    id: parseInt(rawId, 10),
    photoId: parseInt(rawPhotoId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [collection] = await db.select().from(collectionsTable).where(eq(collectionsTable.id, params.data.id));
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  await db
    .delete(photoCollectionsTable)
    .where(
      and(
        eq(photoCollectionsTable.collectionId, params.data.id),
        eq(photoCollectionsTable.photoId, params.data.photoId)
      )
    );

  if (collection.coverPhotoId === params.data.photoId) {
    await db
      .update(collectionsTable)
      .set({ coverPhotoId: null })
      .where(eq(collectionsTable.id, params.data.id));
  }

  res.sendStatus(204);
});

export default router;
