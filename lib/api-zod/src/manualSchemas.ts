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
