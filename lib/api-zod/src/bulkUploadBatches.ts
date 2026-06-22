import { z } from "zod";

export const CreateBulkUploadBatchBody = z.object({
  groupNames: z.array(z.string()),
  albumIds: z.array(z.number().int()),
  totalUploaded: z.number().int().min(0),
  failedCount: z.number().int().min(0),
});

export const BulkUploadBatchItem = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  groupNames: z.array(z.string()),
  albumIds: z.array(z.number().int()),
  totalUploaded: z.number().int(),
  failedCount: z.number().int(),
  createdAt: z.coerce.date(),
});

export const CreateBulkUploadBatchResponse = BulkUploadBatchItem;
export const ListBulkUploadBatchesResponse = z.array(BulkUploadBatchItem);

export type BulkUploadBatchItemType = z.infer<typeof BulkUploadBatchItem>;
export type CreateBulkUploadBatchBodyType = z.infer<typeof CreateBulkUploadBatchBody>;
