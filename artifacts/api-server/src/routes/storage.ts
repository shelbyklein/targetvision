import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { and, eq } from "drizzle-orm";
import { db, organizationMembersTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/requireAuth";
import { requireOrgAuth } from "../middlewares/requireOrg";

// All private object routes require an authenticated user. Org-prefixed keys
// (orgs/<id>/…, minted since #113) additionally require membership of that org;
// legacy keys predate tenanting and stay readable by any signed-in member.

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// If the object path is tenant-scoped (orgs/<id>/…), the caller must belong to
// that org. Returns true when access is allowed. Legacy (unprefixed) keys pass.
export async function mayAccessObjectPath(userId: number, wildcardPath: string): Promise<boolean> {
  const m = wildcardPath.match(/^orgs\/(\d+)\//);
  if (!m) return true;
  const objOrgId = Number.parseInt(m[1], 10);
  const [membership] = await db
    .select({ userId: organizationMembersTable.userId })
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.organizationId, objOrgId), eq(organizationMembersTable.userId, userId)));
  return Boolean(membership);
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Requires authentication — only signed-in users may mint upload URLs.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireOrgAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image file types are allowed" });
      return;
    }

    // Key the upload under the caller's active org (#113).
    let uploadURL = await objectStorageService.getObjectEntityUploadURL(req.org!.id);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // In local dev the browser can't PUT cross-origin to fake-gcs-server, so
    // rewrite the signed URL onto the web app's same-origin proxy prefix
    // (see the /gcs proxy in photo-album/vite.config.ts). Server-side callers
    // like thumbnail generation keep using absolute signed URLs.
    const browserPrefix = process.env.GCS_BROWSER_UPLOAD_PREFIX;
    if (browserPrefix) {
      const parsedUrl = new URL(uploadURL);
      uploadURL = `${browserPrefix}${parsedUrl.pathname}${parsedUrl.search}`;
    }

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;

    // Tenant ACL (#113): an org-prefixed object is only served to a member of
    // that org. 404 (not 403) so a non-member can't probe which keys exist.
    if (!(await mayAccessObjectPath(req.dbUser!.id, wildcardPath))) {
      res.status(404).json({ error: "Object not found" });
      return;
    }

    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    // Storage keys are content-addressed — once written they never change.
    // Cache aggressively so browsers never re-download the same thumbnail/photo.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
