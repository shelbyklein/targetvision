import { randomUUID } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { getOriginalFile } from "./photoLibrary.js";

function tokenMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function startHttpServer(): Promise<void> {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token || token.length < 24) {
    throw new Error(
      "MCP_AUTH_TOKEN must be set (>= 24 chars) to run the HTTP transport — it is exposed publicly via the tunnel.",
    );
  }
  const port = Number(process.env.MCP_HTTP_PORT) || 8086;
  // Public base for download links returned by get_photo, e.g.
  // https://targetvision-mcp.shelbyklein.com — token prefix is appended here.
  const publicUrl = process.env.MCP_PUBLIC_URL?.replace(/\/$/, "");

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Unauthenticated liveness probe (no library data).
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  // Auth: either `Authorization: Bearer <token>`, or the token as the first
  // path segment (`/<token>/mcp`). The URL form exists because claude.ai's
  // custom-connector UI only accepts a URL — no header field. Over HTTPS the
  // path is encrypted in transit; treat the URL itself as a secret.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ") && tokenMatches(header.slice("Bearer ".length), token)) {
      next();
      return;
    }
    const segments = req.path.split("/").filter(Boolean);
    if (segments.length > 0 && tokenMatches(decodeURIComponent(segments[0]), token)) {
      req.url = req.url.replace(`/${segments[0]}`, "") || "/";
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
  });

  const externalDownloadBase = publicUrl ? `${publicUrl}/${token}` : undefined;

  // Stateless streamable HTTP: a fresh server+transport pair per request.
  // Tools-only usage needs no session affinity, and statelessness survives
  // process restarts without breaking connected clients.
  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createServer({ externalDownloadBase });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32603, message: "Internal server error" },
        });
      }
      console.error(`[${randomUUID().slice(0, 8)}] MCP request failed:`, err);
    }
  });

  // Stateless mode has no sessions to GET/DELETE.
  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method not allowed: stateless transport (POST only)" },
    });
  });
  app.delete("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method not allowed: stateless transport (POST only)" },
    });
  });

  // Authenticated full-resolution download — what get_photo's link points at
  // when MCP_PUBLIC_URL is set.
  app.get("/photo/:id/original", async (req: Request, res: Response) => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid photo id" });
      return;
    }
    const file = await getOriginalFile(id);
    if (!file) {
      res.status(404).json({ error: "Photo not found" });
      return;
    }
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${file.filename.replace(/[^\w .-]+/g, "")}"`);
    res.send(file.buffer);
  });

  await new Promise<void>((resolve) => {
    app.listen(port, () => resolve());
  });
  console.error(`TargetVision MCP HTTP server listening on :${port} (public URL: ${publicUrl ?? "unset"})`);
}
