// Bootstrap for the Vispix MCP server (stdio transport).
//
// stdout IS the MCP protocol channel, so nothing else may write to it. The
// api-server libs we reuse log through pino (stdout by default), so silence
// logging and skip the pino-pretty transport BEFORE any of them load — which
// is why the real server is pulled in with a dynamic import below (static
// imports would hoist above these assignments).
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const { startServer } = await import("./server.js");

startServer().catch((err) => {
  console.error("Vispix MCP server failed to start:", err);
  process.exit(1);
});

export {};
