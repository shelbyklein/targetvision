import { z } from "zod";
import { GetPhotoResponse } from "./generated/api";

export const ListAlbumPhotosPagedResponse = z.object({
  photos: z.array(GetPhotoResponse),
  hasMore: z.boolean(),
});

export const CheckDuplicatesBody = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
    })
  ),
});

export const CheckDuplicatesResponse = z.object({
  duplicates: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      photoId: z.number(),
    })
  ),
});

export const BackfillThumbnailsResponse = z.object({
  processed: z.number(),
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const BackfillThumbnailsStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillExifDatesStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillExifDatesResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const BackfillAiAnalysisStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillAiAnalysisBody = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

export const BackfillAiAnalysisResponse = z.object({
  processed: z.number(),
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const AiBackfillRun = z.object({
  id: z.number(),
  trigger: z.enum(["manual", "automatic"]),
  requestedLimit: z.number().nullable(),
  processed: z.number(),
  succeeded: z.number(),
  skipped: z.number(),
  failed: z.number(),
  createdAt: z.string(),
});

export const ListAiBackfillRunsResponse = z.array(AiBackfillRun);

export const AiAutoBackfillSettings = z.object({
  enabled: z.boolean(),
  batchSize: z.number().int().positive(),
});

export const GetAiAutoBackfillSettingsResponse = AiAutoBackfillSettings;

export const UpdateAiAutoBackfillSettingsBody = z.object({
  enabled: z.boolean().optional(),
  batchSize: z.number().int().positive().max(1000).optional(),
});

export const UpdateAiAutoBackfillSettingsResponse = AiAutoBackfillSettings;
