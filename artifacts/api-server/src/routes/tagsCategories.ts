import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tagsTable, categoriesTable } from "@workspace/db";
import {
  ListTagsResponse,
  CreateTagBody,
  ListCategoriesResponse,
  CreateCategoryBody,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/tags", requireAuth, async (req, res): Promise<void> => {
  const tags = await db.select().from(tagsTable).orderBy(tagsTable.name);
  res.json(ListTagsResponse.parse(tags));
});

router.post("/tags", requireAuth, async (req, res): Promise<void> => {
  const body = CreateTagBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(tagsTable).where(eq(tagsTable.name, body.data.name));
  if (existing) {
    res.status(201).json(existing);
    return;
  }

  const [tag] = await db.insert(tagsTable).values(body.data).returning();
  res.status(201).json(tag);
});

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(categories));
});

router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [category] = await db.insert(categoriesTable).values(body.data).returning();
  res.status(201).json(category);
});

router.delete("/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteCategoryParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
