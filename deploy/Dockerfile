# Vispix production image. One shared builder, two runtime targets:
#   - `app`  → runs the API bundle, the MCP gateway, and DB migrations
#   - `web`  → nginx serving the static Vite build + proxying /api → api
# Build context is the repo root (the whole pnpm monorepo).

# ---- builder: install + build everything once ----
FROM node:24-slim AS builder
RUN corepack enable
WORKDIR /app
# Put the flat (hoisted) .bin on PATH so we can call tsc/vite/esbuild directly.
ENV PATH="/app/node_modules/.bin:${PATH}"

# Copy the whole workspace (node_modules/dist excluded via .dockerignore so the
# Linux image never inherits Windows-built native binaries like sharp).
COPY . .

# --ignore-scripts: skip dependency postinstall scripts. sharp 0.34 and esbuild
#   ship prebuilt platform binaries via optional deps (no compile needed), so we
#   avoid pulling a C toolchain in just to run flaky native postinstalls.
# --node-linker=hoisted: flat node_modules with a single top-level .bin.
RUN pnpm install --frozen-lockfile --ignore-scripts --node-linker=hoisted

# Build by invoking the tools directly rather than via `pnpm run` — pnpm's
# script runner misbehaves in this container (shim bins don't resolve under
# `pnpm run`, and its pre-run deps-status check spawns a child pnpm that dies).
# Direct calls sidestep both. Steps mirror the package `build` scripts:
#   typecheck:libs = `tsc --build`; api = `node build.mjs`; web = `vite build`.
RUN tsc --build
RUN node artifacts/api-server/build.mjs
RUN cd artifacts/photo-album && PORT=80 vite build --config vite.config.ts

# ---- app: API / MCP / migrate (command set per-service in compose) ----
FROM node:24-slim AS app
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
# Carries the built api bundle, the mcp/db TypeScript sources, and the full
# node_modules (tsx included, which the MCP gateway and migrate step run on).
COPY --from=builder /app /app
# Default command; overridden by the api/mcp/migrate services.
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

# ---- web: static frontend behind nginx ----
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/artifacts/photo-album/dist/public /usr/share/nginx/html
