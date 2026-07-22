import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, assetsTable, projectsTable } from "@workspace/db";
import {
  ListAssetsQueryParams,
  ListAssetsResponse,
  CreateAssetBody,
  UpdateAssetParams,
  UpdateAssetBody,
  UpdateAssetResponse,
  DeleteAssetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// The asset library (brand marks + reference works) deliberately skips the
// photo pipeline: no thumbnails, no AI analysis, no embeddings. Files are
// uploaded through the storage request-url flow first; these routes only
// manage the metadata rows. Deleting an asset removes the row, not the
// storage object — the bucket is shared between environments, and orphaned
// objects are cheaper than a cross-environment delete.

async function buildAssetResponse(id: number) {
  const [row] = await db
    .select({ asset: assetsTable, projectName: projectsTable.name })
    .from(assetsTable)
    .leftJoin(projectsTable, eq(assetsTable.projectId, projectsTable.id))
    .where(eq(assetsTable.id, id));
  if (!row) return null;
  return {
    ...row.asset,
    projectName: row.projectName ?? null,
    createdAt: row.asset.createdAt.toISOString(),
    updatedAt: row.asset.updatedAt.toISOString(),
  };
}

router.get("/assets", requireAuth, async (req, res): Promise<void> => {
  const query = ListAssetsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { kind, projectId } = query.data;

  const rows = await db
    .select({ asset: assetsTable, projectName: projectsTable.name })
    .from(assetsTable)
    .leftJoin(projectsTable, eq(assetsTable.projectId, projectsTable.id))
    .where(
      and(
        kind ? eq(assetsTable.kind, kind) : undefined,
        projectId != null ? eq(assetsTable.projectId, projectId) : undefined,
      ),
    )
    .orderBy(asc(assetsTable.kind), asc(assetsTable.name));

  const assets = rows.map((row) => ({
    ...row.asset,
    projectName: row.projectName ?? null,
    createdAt: row.asset.createdAt.toISOString(),
    updatedAt: row.asset.updatedAt.toISOString(),
  }));
  res.json(ListAssetsResponse.parse(assets));
});

router.post("/assets", requireAuth, async (req, res): Promise<void> => {
  const body = CreateAssetBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Only accept keys minted by our own upload flow, never arbitrary paths.
  if (!body.data.storageKey.startsWith("/objects/")) {
    res.status(400).json({ error: "storageKey must be an /objects/ path from the upload flow" });
    return;
  }

  if (body.data.projectId != null) {
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, body.data.projectId));
    if (!project) {
      res.status(400).json({ error: "Project not found" });
      return;
    }
  }

  const [asset] = await db
    .insert(assetsTable)
    .values({ ...body.data, createdById: req.dbUser!.id })
    .returning();

  const full = await buildAssetResponse(asset.id);
  res.status(201).json(UpdateAssetResponse.parse(full));
});

router.patch("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAssetParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateAssetBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  if (existing.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (body.data.projectId != null) {
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, body.data.projectId));
    if (!project) {
      res.status(400).json({ error: "Project not found" });
      return;
    }
  }

  await db
    .update(assetsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(assetsTable.id, params.data.id));

  const full = await buildAssetResponse(params.data.id);
  res.json(UpdateAssetResponse.parse(full));
});

router.delete("/assets/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAssetParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  if (existing.createdById !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(assetsTable).where(eq(assetsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
