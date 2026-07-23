// Bootstrap for the Vispix MCP server over streamable HTTP — remote
// access for clients off this machine (claude.ai custom connectors, Claude
// Code on other machines, etc.), fronted by the cloudflared tunnel.
//
// Unlike the stdio entry, stdout is NOT the protocol channel here, but the
// api-server libs' pino logging is still silenced for consistency; this
// process logs its own startup line to stderr.
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const { startHttpServer } = await import("./httpServer.js");

startHttpServer().catch((err) => {
  console.error("Vispix MCP HTTP server failed to start:", err);
  process.exit(1);
});

export {};
