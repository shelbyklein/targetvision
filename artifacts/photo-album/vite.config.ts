import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Default to "/" rather than requiring BASE_PATH=/ on the command line:
// Git Bash on Windows rewrites a bare "/" value into the Git install path
// (MSYS path conversion), silently corrupting the base.
const basePath = process.env.BASE_PATH ?? "/";

if (!basePath.startsWith("/")) {
  throw new Error(
    `BASE_PATH must start with "/" but was "${basePath}".`,
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 8080}`,
        changeOrigin: true,
      },
      // Browser uploads go to fake-gcs-server through this same-origin proxy,
      // avoiding cross-origin preflight against the emulator.
      "/gcs": {
        target: process.env.GCS_ENDPOINT ?? "http://localhost:4443",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gcs/, ""),
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
