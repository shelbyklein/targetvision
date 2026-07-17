import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, attributionTagsTable, photoAttributionTagsTable, photosTable } from "@workspace/db";
import {
  ListAttributionTagsResponse,
  CreateAttributionTagBody,
  UpdateAttributionTagBody,
  // Also used for the create response — orval doesn't emit schemas for 201s,
  // and the shapes are identical ({ id, name }).
  UpdateAttributionTagResponse,
  BulkSetAttributionTagsBody,
  BulkSetAttributionTagsResponse,
  AddPhotoAttributionTagBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/attribution-tags", requireAuth, async (_req, res): Promise<void> => {
  const tags = await db.select().from(attributionTagsTable).orderBy(attributionTagsTable.name);
  res.json(ListAttributionTagsResponse.parse(tags.map((t) => ({ id: t.id, name: t.name }))));
});

router.post("/attribution-tags", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateAttributionTagBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const name = body.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Tag name cannot be empty" });
    return;
  }
  const [existing] = await db.select().from(attributionTagsTable).where(eq(attributionTagsTable.name, name));
  if (existing) {
    res.status(409).json({ error: "A tag with that name already exists" });
    return;
  }
  const [tag] = await db.insert(attributionTagsTable).values({ name }).returning();
  res.status(201).json(UpdateAttributionTagResponse.parse({ id: tag.id, name: tag.name }));
});

router.patch("/attribution-tags/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid tag id" });
    return;
  }
  const body = UpdateAttributionTagBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const name = body.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Tag name cannot be empty" });
    return;
  }
  const [tag] = await db
    .update(attributionTagsTable)
    .set({ name })
    .where(eq(attributionTagsTable.id, id))
    .returning();
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.json(UpdateAttributionTagResponse.parse({ id: tag.id, name: tag.name }));
});

router.delete("/attribution-tags/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid tag id" });
    return;
  }
  const deleted = await db
    .delete(attributionTagsTable)
    .where(eq(attributionTagsTable.id, id))
    .returning({ id: attributionTagsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.status(204).send();
});

// Bulk add/remove a tag on a set of photos (the album select-mode flow).
// Registered as /photos/attribution-tags/bulk (not /photos/bulk/...) so it can
// never be shadowed by /photos/:id patterns regardless of mount order.
router.post("/photos/attribution-tags/bulk", requireAdmin, async (req, res): Promise<void> => {
  const body = BulkSetAttributionTagsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { ids, tagId, mode } = body.data;

  const [tag] = await db.select().from(attributionTagsTable).where(eq(attributionTagsTable.id, tagId));
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  if (mode === "add") {
    const existing = await db
      .select({ id: photosTable.id })
      .from(photosTable)
      .where(inArray(photosTable.id, ids));
    if (existing.length === 0) {
      res.json(BulkSetAttributionTagsResponse.parse({ updated: 0 }));
      return;
    }
    const inserted = await db
      .insert(photoAttributionTagsTable)
      .values(existing.map((p) => ({ photoId: p.id, tagId })))
      .onConflictDoNothing()
      .returning({ photoId: photoAttributionTagsTable.photoId });
    res.json(BulkSetAttributionTagsResponse.parse({ updated: inserted.length }));
  } else {
    const deleted = await db
      .delete(photoAttributionTagsTable)
      .where(and(inArray(photoAttributionTagsTable.photoId, ids), eq(photoAttributionTagsTable.tagId, tagId)))
      .returning({ photoId: photoAttributionTagsTable.photoId });
    res.json(BulkSetAttributionTagsResponse.parse({ updated: deleted.length }));
  }
});

router.post("/photos/:id/attribution-tags", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const photoId = parseInt(raw, 10);
  if (!Number.isInteger(photoId)) {
    res.status(400).json({ error: "Invalid photo id" });
    return;
  }
  const body = AddPhotoAttributionTagBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [photo] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, photoId));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  const [tag] = await db.select().from(attributionTagsTable).where(eq(attributionTagsTable.id, body.data.tagId));
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  await db
    .insert(photoAttributionTagsTable)
    .values({ photoId, tagId: body.data.tagId })
    .onConflictDoNothing();
  res.status(204).send();
});

router.delete("/photos/:id/attribution-tags/:tagId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawTagId = Array.isArray(req.params.tagId) ? req.params.tagId[0] : req.params.tagId;
  const photoId = parseInt(rawId, 10);
  const tagId = parseInt(rawTagId, 10);
  if (!Number.isInteger(photoId) || !Number.isInteger(tagId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .delete(photoAttributionTagsTable)
    .where(and(eq(photoAttributionTagsTable.photoId, photoId), eq(photoAttributionTagsTable.tagId, tagId)));
  res.status(204).send();
});

export default router;
