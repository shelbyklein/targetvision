import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, bulkUploadBatchesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  CreateBulkUploadBatchBody,
  CreateBulkUploadBatchResponse,
  ListBulkUploadBatchesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/bulk-upload-batches", requireAuth, async (req, res): Promise<void> => {
  const body = CreateBulkUploadBatchBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [batch] = await db
    .insert(bulkUploadBatchesTable)
    .values({
      userId: req.dbUser!.id,
      groupNames: body.data.groupNames,
      albumIds: body.data.albumIds,
      totalUploaded: body.data.totalUploaded,
      failedCount: body.data.failedCount,
    })
    .returning();

  res.status(201).json(CreateBulkUploadBatchResponse.parse(batch));
});

router.get("/bulk-upload-batches", requireAuth, async (req, res): Promise<void> => {
  const batches = await db
    .select()
    .from(bulkUploadBatchesTable)
    .where(eq(bulkUploadBatchesTable.userId, req.dbUser!.id))
    .orderBy(desc(bulkUploadBatchesTable.createdAt))
    .limit(50);

  res.json(ListBulkUploadBatchesResponse.parse(batches));
});

export default router;
