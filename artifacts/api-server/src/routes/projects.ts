import { Router, type IRouter } from "express";
import { eq, count, sql, and } from "drizzle-orm";
import { db, projectsTable, projectPhotosTable, photosTable } from "@workspace/db";
import {
  ListProjectsResponse,
  CreateProjectBody,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  AddPhotoToProjectParams,
  AddPhotoToProjectBody,
  RemovePhotoFromProjectParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { buildPhotosResponse } from "../lib/photoHelpers";

const router: IRouter = Router();

async function buildProjectResponse(projectId: number) {
  const [row] = await db
    .select({
      project: projectsTable,
      photoCount: count(projectPhotosTable.photoId),
    })
    .from(projectsTable)
    .leftJoin(projectPhotosTable, eq(projectsTable.id, projectPhotosTable.projectId))
    .where(eq(projectsTable.id, projectId))
    .groupBy(projectsTable.id);

  if (!row) return null;

  const coverPhotoRow = await db
    .select({ url: photosTable.url, thumbnailKey: photosTable.thumbnailKey })
    .from(projectPhotosTable)
    .innerJoin(photosTable, eq(projectPhotosTable.photoId, photosTable.id))
    .where(eq(projectPhotosTable.projectId, projectId))
    .orderBy(sql`${projectPhotosTable.addedAt} desc`)
    .limit(1);

  return {
    ...row.project,
    createdAt: row.project.createdAt.toISOString(),
    updatedAt: row.project.updatedAt.toISOString(),
    photoCount: Number(row.photoCount),
    coverPhotoUrl: coverPhotoRow[0]?.url ?? null,
    coverPhotoThumbnailKey: coverPhotoRow[0]?.thumbnailKey ?? null,
  };
}

router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      project: projectsTable,
      photoCount: count(projectPhotosTable.photoId),
    })
    .from(projectsTable)
    .leftJoin(projectPhotosTable, eq(projectsTable.id, projectPhotosTable.projectId))
    .groupBy(projectsTable.id)
    .orderBy(sql`${projectsTable.updatedAt} desc`);

  const projects = await Promise.all(
    rows.map(async (row) => {
      const coverPhotoRow = await db
        .select({ url: photosTable.url, thumbnailKey: photosTable.thumbnailKey })
        .from(projectPhotosTable)
        .innerJoin(photosTable, eq(projectPhotosTable.photoId, photosTable.id))
        .where(eq(projectPhotosTable.projectId, row.project.id))
        .orderBy(sql`${projectPhotosTable.addedAt} desc`)
        .limit(1);

      return {
        ...row.project,
        createdAt: row.project.createdAt.toISOString(),
        updatedAt: row.project.updatedAt.toISOString(),
        photoCount: Number(row.photoCount),
        coverPhotoUrl: coverPhotoRow[0]?.url ?? null,
        coverPhotoThumbnailKey: coverPhotoRow[0]?.thumbnailKey ?? null,
      };
    })
  );

  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const body = CreateProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({ ...body.data, createdById: req.dbUser!.id })
    .returning();

  const full = await buildProjectResponse(project.id);
  res.status(201).json(GetProjectResponse.parse(full));
});

router.get("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const full = await buildProjectResponse(params.data.id);
  if (!full) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const photoRows = await db
    .select({ id: projectPhotosTable.photoId })
    .from(projectPhotosTable)
    .where(eq(projectPhotosTable.projectId, params.data.id))
    .orderBy(projectPhotosTable.addedAt, projectPhotosTable.photoId);

  const photos = await buildPhotosResponse(photoRows.map((p) => p.id), req.dbUser?.id);

  res.json(GetProjectResponse.parse({ ...full, photos }));
});

router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (existing.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(projectsTable.id, params.data.id));

  const full = await buildProjectResponse(params.data.id);
  res.json(UpdateProjectResponse.parse(full));
});

router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (existing.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/projects/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddPhotoToProjectParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AddPhotoToProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [photo] = await db.select({ id: photosTable.id }).from(photosTable).where(eq(photosTable.id, body.data.photoId));
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  await db
    .insert(projectPhotosTable)
    .values({ projectId: params.data.id, photoId: body.data.photoId })
    .onConflictDoNothing();

  await db.update(projectsTable).set({ updatedAt: new Date() }).where(eq(projectsTable.id, params.data.id));

  res.sendStatus(204);
});

router.delete("/projects/:id/photos/:photoId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawPhotoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
  const params = RemovePhotoFromProjectParams.safeParse({
    id: parseInt(rawId, 10),
    photoId: parseInt(rawPhotoId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .delete(projectPhotosTable)
    .where(
      and(
        eq(projectPhotosTable.projectId, params.data.id),
        eq(projectPhotosTable.photoId, params.data.photoId)
      )
    );

  await db.update(projectsTable).set({ updatedAt: new Date() }).where(eq(projectsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
