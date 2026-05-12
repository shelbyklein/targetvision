import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, albumsTable, photosTable, usersTable } from "@workspace/db";
import {
  ListAlbumsResponse,
  ListAlbumsResponseItem,
  CreateAlbumBody,
  GetAlbumParams,
  GetAlbumResponse,
  UpdateAlbumParams,
  UpdateAlbumBody,
  UpdateAlbumResponse,
  DeleteAlbumParams,
  SetAlbumCoverParams,
  SetAlbumCoverBody,
  SetAlbumCoverResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function buildAlbumResponse(albumId: number) {
  const [row] = await db
    .select({
      album: albumsTable,
      ownerName: usersTable.name,
      photoCount: count(photosTable.id),
    })
    .from(albumsTable)
    .leftJoin(usersTable, eq(albumsTable.ownerId, usersTable.id))
    .leftJoin(photosTable, eq(albumsTable.id, photosTable.albumId))
    .where(eq(albumsTable.id, albumId))
    .groupBy(albumsTable.id, usersTable.name);

  if (!row) return null;

  let coverPhotoUrl: string | null = null;
  if (row.album.coverPhotoId) {
    const [cover] = await db
      .select({ url: photosTable.url })
      .from(photosTable)
      .where(eq(photosTable.id, row.album.coverPhotoId));
    coverPhotoUrl = cover?.url ?? null;
  }

  return {
    ...row.album,
    ownerName: row.ownerName ?? null,
    photoCount: Number(row.photoCount),
    coverPhotoUrl,
  };
}

router.get("/albums", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      album: albumsTable,
      ownerName: usersTable.name,
      photoCount: count(photosTable.id),
    })
    .from(albumsTable)
    .leftJoin(usersTable, eq(albumsTable.ownerId, usersTable.id))
    .leftJoin(photosTable, eq(albumsTable.id, photosTable.albumId))
    .groupBy(albumsTable.id, usersTable.name)
    .orderBy(sql`${albumsTable.createdAt} desc`);

  const albums = await Promise.all(
    rows.map(async (row) => {
      let coverPhotoUrl: string | null = null;
      if (row.album.coverPhotoId) {
        const [cover] = await db
          .select({ url: photosTable.url })
          .from(photosTable)
          .where(eq(photosTable.id, row.album.coverPhotoId));
        coverPhotoUrl = cover?.url ?? null;
      }
      return {
        ...row.album,
        ownerName: row.ownerName ?? null,
        photoCount: Number(row.photoCount),
        coverPhotoUrl,
      };
    })
  );

  res.json(ListAlbumsResponse.parse(albums));
});

router.post("/albums", requireAuth, async (req, res): Promise<void> => {
  const body = CreateAlbumBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [album] = await db
    .insert(albumsTable)
    .values({ ...body.data, ownerId: req.dbUser!.id })
    .returning();

  const full = await buildAlbumResponse(album.id);
  res.status(201).json(GetAlbumResponse.parse(full));
});

router.get("/albums/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAlbumParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const full = await buildAlbumResponse(params.data.id);
  if (!full) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  res.json(GetAlbumResponse.parse(full));
});

router.patch("/albums/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAlbumParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateAlbumBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(albumsTable).where(eq(albumsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  if (existing.ownerId !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.update(albumsTable).set(body.data).where(eq(albumsTable.id, params.data.id));
  const full = await buildAlbumResponse(params.data.id);
  res.json(UpdateAlbumResponse.parse(full));
});

router.delete("/albums/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAlbumParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(albumsTable).where(eq(albumsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  if (existing.ownerId !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(albumsTable).where(eq(albumsTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/albums/:id/cover", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SetAlbumCoverParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SetAlbumCoverBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(albumsTable).where(eq(albumsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  if (existing.ownerId !== req.dbUser!.id && req.dbUser!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(albumsTable)
    .set({ coverPhotoId: body.data.photoId })
    .where(eq(albumsTable.id, params.data.id));

  const full = await buildAlbumResponse(params.data.id);
  res.json(SetAlbumCoverResponse.parse(full));
});

export default router;
