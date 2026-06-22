#!/usr/bin/env node
/**
 * Replit-aware Expo dev wrapper.
 *
 * Replit's health check requires PORT to stay open continuously.
 * Metro takes ~15 s to warm up, so this wrapper:
 *   1. Opens a single HTTP server on PORT immediately (passes health check).
 *   2. Spawns `expo start` on PORT+1.
 *   3. Once Metro is accepting connections, swaps the request handler to
 *      proxy traffic to PORT+1 — the server never closes, so the port
 *      stays open the whole time.
 */

import http from "http";
import net from "net";
import { spawn } from "child_process";

const PORT = Number(process.env.PORT ?? 18115);
const METRO_PORT = PORT + 1;

// Current request handler — starts as a placeholder, swapped to proxy later.
let handleRequest = (_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("Metro is starting…\n");
};

// Single persistent server — never closed so the port is always open.
const server = http.createServer((req, res) => handleRequest(req, res));

// WebSocket passthrough handler (swapped to proxy once Metro is up).
let handleUpgrade = (_req, socket) => socket.destroy();

server.on("upgrade", (req, socket, head) => handleUpgrade(req, socket, head));

server.listen(PORT, () => {
  console.log(`[dev-start] server open on port ${PORT}`);
  startExpo();
});

// ── Spawn Expo on METRO_PORT ─────────────────────────────────────────────────
function startExpo() {
  const expo = spawn("pnpm", ["exec", "expo", "start", "--port", String(METRO_PORT)], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(METRO_PORT) },
  });
  expo.on("exit", (code) => process.exit(code ?? 0));

  // Poll every second until Metro accepts TCP connections.
  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    const s = net.connect(METRO_PORT, "127.0.0.1");
    s.once("connect", () => {
      s.destroy();
      clearInterval(poll);
      console.log(`[dev-start] Metro up after ~${attempts}s — proxying port ${PORT} → ${METRO_PORT}`);
      enableProxy();
    });
    s.once("error", () => s.destroy());
  }, 1000);
}

// ── Swap handlers to transparent proxy ──────────────────────────────────────
function enableProxy() {
  // HTTP proxy
  handleRequest = (req, res) => {
    const upstream = http.request(
      { hostname: "127.0.0.1", port: METRO_PORT, path: req.url, method: req.method, headers: req.headers },
      (upRes) => {
        res.writeHead(upRes.statusCode ?? 200, upRes.headers);
        upRes.pipe(res, { end: true });
      }
    );
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream, { end: true });
  };

  // WebSocket proxy (Metro HMR)
  handleUpgrade = (req, clientSocket, head) => {
    const srv = net.connect(METRO_PORT, "127.0.0.1", () => {
      const hdrs = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
      srv.write(`${req.method} ${req.url} HTTP/1.1\r\n${hdrs}\r\n\r\n`);
      if (head?.length) srv.write(head);
      srv.pipe(clientSocket, { end: true });
      clientSocket.pipe(srv, { end: true });
    });
    srv.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => srv.destroy());
  };
}
