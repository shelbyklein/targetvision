import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchPhotos,
  getPhotoDetail,
  listAlbums,
  listUsageRights,
  loadThumbnailImage,
} from "./photoLibrary.js";

// Cap on inline thumbnails per search response: base64 images are the bulk of
// the payload, and a model judging fit rarely needs more than a screenful.
const MAX_INLINE_IMAGES = 10;

function textBlock(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "targetvision",
    version: "1.0.0",
  });

  server.registerTool(
    "search_photos",
    {
      title: "Search photos semantically",
      description:
        "Find photos in the TargetVision archery photo library that match a natural-language description " +
        "(e.g. 'athlete celebrating a win', 'close-up of an arrow hitting the target'). Results are ranked " +
        "by semantic similarity and include inline thumbnails so you can judge visual fit. " +
        "Use one focused concept per call; make multiple calls for multiple concepts.",
      inputSchema: {
        query: z.string().describe("Natural-language description of the desired imagery"),
        count: z.number().int().min(1).max(50).default(8).describe("How many results to return"),
        exclude: z.string().optional().describe("Concept to steer away from (e.g. 'crowds', 'indoor range')"),
        minRating: z.number().min(1).max(5).optional().describe("Only photos with at least this average star rating"),
        rightsTag: z.string().optional().describe("Only photos cleared for this usage-rights tag (see list_usage_rights)"),
        includeImages: z.boolean().default(true).describe("Inline thumbnail images in the response"),
      },
    },
    async ({ query, count, exclude, minRating, rightsTag, includeImages }) => {
      const { results, note } = await searchPhotos({ query, count, exclude, minRating, rightsTag });
      if (results.length === 0) {
        return { content: [textBlock(note ?? `No photos matched "${query}".`)] };
      }

      const lines = results.map((p, i) => {
        const bits = [
          `${i + 1}. photo #${p.id}`,
          p.filename && `file: ${p.filename}`,
          p.albumTitle && `album: ${p.albumTitle}`,
          p.width && p.height && `${p.width}x${p.height}`,
          p.averageRating != null && `rating: ${p.averageRating.toFixed(1)}/5 (${p.ratingCount})`,
          p.rights.length > 0 && `rights: ${p.rights.join(", ")}`,
        ].filter(Boolean);
        const desc = p.aiDescription ? `\n   ${p.aiDescription.slice(0, 300)}` : "";
        return bits.join(" | ") + desc;
      });

      const content: Array<
        { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
      > = [textBlock(`${results.length} photos for "${query}":\n\n${lines.join("\n")}${note ? `\n\n${note}` : ""}`)];

      if (includeImages) {
        const withImages = results.slice(0, MAX_INLINE_IMAGES);
        for (const p of withImages) {
          const img = await loadThumbnailImage(p.thumbnailKey);
          if (img) {
            content.push(textBlock(`photo #${p.id}:`));
            content.push({ type: "image", data: img.base64, mimeType: img.mimeType });
          }
        }
        if (results.length > withImages.length) {
          content.push(textBlock(`(thumbnails shown for the first ${withImages.length}; use get_photo for the rest)`));
        }
      }

      return { content };
    },
  );

  server.registerTool(
    "get_photo",
    {
      title: "Get one photo in full detail",
      description:
        "Fetch a single photo by id: full metadata, its thumbnail image, and a time-limited signed URL " +
        "to download the full-resolution file.",
      inputSchema: {
        id: z.number().int().describe("Photo id (from search_photos results)"),
      },
    },
    async ({ id }) => {
      const detail = await getPhotoDetail(id);
      if (!detail) {
        return { content: [textBlock(`Photo #${id} not found.`)], isError: true };
      }
      const { photo, fullResUrl } = detail;
      const lines = [
        `photo #${photo.id}`,
        photo.filename && `file: ${photo.filename}`,
        photo.albumTitle && `album: ${photo.albumTitle}`,
        photo.width && photo.height && `dimensions: ${photo.width}x${photo.height}`,
        photo.averageRating != null && `rating: ${photo.averageRating.toFixed(1)}/5 (${photo.ratingCount} ratings)`,
        photo.rights.length > 0 ? `usage rights: ${photo.rights.join(", ")}` : "usage rights: none recorded",
        photo.takenAt && `taken: ${photo.takenAt}`,
        photo.aiDescription && `description: ${photo.aiDescription}`,
        fullResUrl && `full-resolution download (valid ~1h): ${fullResUrl}`,
      ].filter(Boolean);

      const content: Array<
        { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
      > = [textBlock(lines.join("\n"))];
      const img = await loadThumbnailImage(photo.thumbnailKey);
      if (img) content.push({ type: "image", data: img.base64, mimeType: img.mimeType });
      return { content };
    },
  );

  server.registerTool(
    "list_albums",
    {
      title: "List albums",
      description: "List the photo library's albums with photo counts, to scope or describe searches.",
      inputSchema: {},
    },
    async () => {
      const albums = await listAlbums();
      const lines = albums.map((a) => `#${a.id} ${a.title} — ${a.photoCount} photos`);
      return { content: [textBlock(lines.join("\n") || "No albums.")] };
    },
  );

  server.registerTool(
    "list_usage_rights",
    {
      title: "List usage-rights tags",
      description:
        "List the attribution / usage-rights tags photos can be cleared for (e.g. social media, USA Archery, " +
        "World Archery). Pass a tag name as search_photos' rightsTag to restrict results to cleared photos.",
      inputSchema: {},
    },
    async () => {
      const tags = await listUsageRights();
      const lines = tags.map((t) => `${t.name} — ${t.photoCount} photos cleared`);
      return { content: [textBlock(lines.join("\n") || "No usage-rights tags defined.")] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
