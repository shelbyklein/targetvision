import { z } from "zod";
import { GetPhotoResponse } from "./generated/api";

export const ListAlbumPhotosPagedResponse = z.object({
  photos: z.array(GetPhotoResponse),
  hasMore: z.boolean(),
});

export const ListPhotosPagedResponse = z.object({
  photos: z.array(GetPhotoResponse),
  hasMore: z.boolean(),
});

export const SearchPhotosPagedResponse = z.object({
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

export const BackfillContentHashesStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillContentHashesResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

export const PerceptualHashBackfillStatusResponse = z.object({
  missingCount: z.number(),
});

export const BackfillPerceptualHashesResponse = z.object({
  processed: z.number(),
  updated: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

// Shape matches the generated DuplicatePhoto type so the admin UI can reuse the
// same photo card for near-duplicate groups.
const NearDuplicatePhotoSchema = z.object({
  id: z.number(),
  albumId: z.number(),
  albumTitle: z.string().nullable(),
  filename: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string(),
  isAlbumCover: z.boolean(),
  collectionCount: z.number(),
});

export const NearDuplicatePhotoGroupsResponse = z.object({
  threshold: z.number(),
  groups: z.array(
    z.object({
      key: z.string(),
      distance: z.number(),
      photos: z.array(NearDuplicatePhotoSchema),
    }),
  ),
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

// --- Image embeddings (Vertex AI) ---
export const EmbeddingStatusResponse = z.object({
  enabled: z.boolean(),
  projectConfigured: z.boolean(),
  credentialsConfigured: z.boolean(),
  model: z.string(),
  location: z.string(),
  embeddedCount: z.number(),
  missingCount: z.number(),
});

export const UpdateEmbeddingSettingsBody = z.object({
  enabled: z.boolean(),
});

export const BackfillEmbeddingsBody = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

export const BackfillEmbeddingsResponse = z.object({
  processed: z.number(),
  succeeded: z.number(),
  failed: z.number(),
});

// --- Image optimization (WebP on import) ---
export const ImageOptimizationStatusResponse = z.object({
  enabled: z.boolean(),
  quality: z.number(),
  maxEdge: z.number(),
});

export const UpdateImageOptimizationSettingsBody = z.object({
  enabled: z.boolean(),
});
