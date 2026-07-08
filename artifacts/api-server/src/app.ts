import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

class CorsOriginError extends Error {
  constructor() {
    super("Not allowed by CORS");
    this.name = "CorsOriginError";
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const defaultOrigins = ["http://localhost:8080", "http://localhost:8081"];
const extraOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...extraOrigins]);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // No Origin header (server-to-server, curl) — allow.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new CorsOriginError());
    },
  }),
);

// Better Auth must be mounted before express.json(): its handler reads the
// raw request body, which hangs if the JSON middleware has already consumed it.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    res.end();
    return;
  }
  if (err instanceof CorsOriginError) {
    res.status(403).json({ error: "Not allowed by CORS" });
    return;
  }
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
