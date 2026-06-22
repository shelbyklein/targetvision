import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface BulkUploadBatchRecord {
  id: number;
  userId: number;
  groupNames: string[];
  albumIds: number[];
  totalUploaded: number;
  failedCount: number;
  createdAt: string;
}

export interface CreateBulkUploadBatchInput {
  groupNames: string[];
  albumIds: number[];
  totalUploaded: number;
  failedCount: number;
}

export const getListBulkUploadBatchesQueryKey = () =>
  ["listBulkUploadBatches"] as const;

export function useListBulkUploadBatches() {
  return useQuery({
    queryKey: getListBulkUploadBatchesQueryKey(),
    queryFn: () => customFetch<BulkUploadBatchRecord[]>("/api/bulk-upload-batches"),
  });
}

export async function createBulkUploadBatch(
  input: CreateBulkUploadBatchInput
): Promise<BulkUploadBatchRecord> {
  return customFetch<BulkUploadBatchRecord>("/api/bulk-upload-batches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
