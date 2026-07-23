# Replit → Local Migration Guide

> **Status: completed, then superseded.** The migration below was executed on 2026-07-02. Afterwards, Clerk was replaced with Better Auth and GCS with fake-gcs-server so the app runs fully locally with no cloud accounts — see CLAUDE.md for the current setup. Steps 4–6 of this guide (GCS bucket, AI gateway repointing, Clerk keys) no longer apply as written.

A step-by-step guide for converting this Replit-exported app into a locally runnable project that can later be deployed anywhere. Written for a Claude Code session to execute; every file path and env var below was verified against this repo.

## What this app is

A pnpm-workspace monorepo (Node 24, TypeScript 5.9):

| Package | Path | What it is |
|---|---|---|
| `@workspace/api-server` | `artifacts/api-server` | Express 5 API. Drizzle/Postgres, Clerk auth, GCS object storage, AI providers (OpenAI/Anthropic/Gemini), sharp thumbnails |
| `@workspace/photo-album` | `artifacts/photo-album` | Vite + React web frontend (Radix/Tailwind, Clerk, wouter) |
| `@workspace/mobile` | `artifacts/mobile` | Expo / React Native app (expo-router) |
| `@workspace/mockup-sandbox` | `artifacts/mockup-sandbox` | Design sandbox, low priority |
| `lib/db` | `lib/db` | Drizzle schema + `drizzle-kit push` + seed |
| `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` | `lib/*` | OpenAPI spec + Orval-generated Zod schemas and React Query hooks |
| `lib/integrations-openai-ai-server` | | OpenAI client wrapper (reads `AI_INTEGRATIONS_*` env) |
| `lib/object-storage-web` | | Frontend upload helper for object storage |

On Replit, the `.replit` file orchestrated everything (workflows, ports, env). Locally we replace that with `.env` + npm scripts.

## Prerequisites

- Node 24 (`.replit` used `nodejs-24`; Node ≥20.6 needed for `--env-file` if you use it)
- pnpm (the root `preinstall` script rejects npm/yarn)
- PostgreSQL 16 (`brew install postgresql@16` or Docker)

## Step 1 — Install and baseline

```sh
pnpm install
pnpm run typecheck   # should pass before any changes; if not, note the failures first
```

## Step 2 — Environment variables

Replit injected secrets invisibly; locally nothing loads them. Create `.env` at the repo root (already gitignore it — check `.gitignore`, add `.env` if missing) and a committed `.env.example`.

Complete inventory, verified by grepping `process.env` across the repo:

```sh
# --- Required to boot the API server ---
PORT=8080                          # api-server throws without it (artifacts/api-server/src/index.ts)
DATABASE_URL=postgres://localhost:5432/vispix   # lib/db/src/index.ts throws without it
SESSION_SECRET=<generate: openssl rand -hex 32>
CLERK_PUBLISHABLE_KEY=pk_test_...  # from a Clerk dev instance (clerk.com)
CLERK_SECRET_KEY=sk_test_...

# --- Object storage (see Step 4) ---
PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket/public   # comma-separated /bucket/path entries
PRIVATE_OBJECT_DIR=/your-bucket/private

# --- AI providers (see Step 5). Base URLs pointed at Replit's gateway; repoint to the real APIs ---
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
AI_INTEGRATIONS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
AI_INTEGRATIONS_GEMINI_API_KEY=...
AI_KEY_ENCRYPTION_SECRET=<generate: openssl rand -hex 32>

# --- Misc ---
BOOTSTRAP_ADMIN_SECRET=<generate a NEW one — see Step 8>
LOG_LEVEL=info

# --- photo-album (Vite reads these; vite.config.ts throws without PORT/BASE_PATH) ---
# Set when running that package: PORT=8081 BASE_PATH=/ 
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # artifacts/photo-album/src/App.tsx
# VITE_CLERK_PROXY_URL is optional (prod-only Clerk proxying)
```

Wire up loading: the simplest zero-dependency approach is `node --env-file`. Edit `artifacts/api-server/package.json`:

```json
"start": "node --enable-source-maps --env-file-if-exists=../../.env ./dist/index.mjs"
```

(`--env-file-if-exists` needs Node ≥21.7; on Node 24 it's fine, and it won't break deploys where env comes from the host.) For drizzle-kit and other tools that don't go through node directly, either `export $(grep -v '^#' .env | xargs)` in the shell, use `dotenv-cli`, or use direnv. Pick one and document it in the README/CLAUDE.md.

## Step 3 — PostgreSQL

```sh
createdb vispix            # or via Docker
pnpm --filter @workspace/db run push    # push Drizzle schema (dev workflow — no migration files needed)
pnpm --filter @workspace/db run seed    # optional; check lib/db/src/seed.ts first
```

Note: `scripts/post-merge.sh` runs `pnpm --filter db push --force` — that was a Replit post-merge hook; it no longer runs automatically. Run `push` manually after schema changes.

## Step 4 — Object storage (the biggest Replit coupling)

`artifacts/api-server/src/lib/objectStorage.ts` builds a `@google-cloud/storage` client with **external-account credentials fetched from the Replit sidecar at `http://127.0.0.1:1106`**. This cannot work locally.

Recommended fix (smallest change — keeps the GCS API and all downstream code including `lib/object-storage-web` untouched):

1. Create a GCS bucket + service account with Storage Object Admin on it; download the JSON key.
2. Make the client construction conditional:

```ts
const isReplit = process.env.REPL_ID !== undefined;
export const objectStorageClient = isReplit
  ? new Storage({ credentials: { /* existing sidecar block */ }, projectId: "" })
  : new Storage(); // uses GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC
```

3. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` in `.env`, and point `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` at the new bucket (format is `/<bucket-name>/<prefix>` — see `parseObjectPath` in the same file).

Alternative if no cloud account is wanted: run [fake-gcs-server](https://github.com/fsouza/fake-gcs-server) in Docker and pass `apiEndpoint` to `new Storage()` in dev. A full rewrite to S3/MinIO or local disk is possible but touches ACL logic (`objectAcl.ts`), upload URL signing, and the web upload helper — don't do it unless asked.

Also check `artifacts/api-server/src/lib/thumbnailGeneration.ts`, which uses the same client.

## Step 5 — AI integrations

`lib/integrations-openai-ai-server/src/client.ts` throws unless `AI_INTEGRATIONS_OPENAI_BASE_URL` and `..._API_KEY` are set — on Replit these pointed at Replit's billing gateway. Repoint them at the real provider endpoints (values in Step 2). Before assuming the base URLs above are right, read `artifacts/api-server/src/lib/aiProviders/index.ts` to see exactly how each provider's base URL is consumed (the Anthropic/Gemini SDKs may want the URL with or without a path suffix). The app also appears to support user-supplied keys encrypted with `AI_KEY_ENCRYPTION_SECRET` (see `src/components/admin/AiServicesSection.tsx`), so gateway keys may only be a fallback.

## Step 6 — Auth (Clerk)

Clerk is a normal SaaS, not Replit-specific. Create a free Clerk application, grab the dev keys, set `CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` (server) and `VITE_CLERK_PUBLISHABLE_KEY` (photo-album). `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` only proxies in production, so dev works with keys alone. The frontend also derives a key from the host via `publishableKeyFromHost` (`App.tsx:12`) — read that fallback chain to confirm which key wins locally.

## Step 7 — Run scripts (replace `.replit` workflows)

`.replit` defined the run button, workflows, and port map. Replace with root scripts, e.g.:

```json
"dev:api": "pnpm --filter @workspace/api-server run dev",
"dev:web": "PORT=8081 BASE_PATH=/ pnpm --filter @workspace/photo-album run dev",
"dev:mobile": "pnpm --filter @workspace/mobile exec expo start",
"dev": "concurrently -n api,web \"pnpm dev:api\" \"pnpm dev:web\""
```

(add `concurrently` as a root devDependency, or skip it and use two terminals).

Package-specific fixes:
- **mobile**: its `dev` script hardcodes `$REPLIT_EXPO_DEV_DOMAIN`, `$REPLIT_DEV_DOMAIN`, `$REPL_ID` (see `artifacts/mobile/package.json`). Replace with plain `expo start`. Also check `artifacts/mobile/scripts/build.js` and `app.json` for Replit references, and find where the mobile app gets its API base URL — it likely pointed at a Replit domain and needs to become configurable (e.g. `EXPO_PUBLIC_API_URL`).
- **photo-album**: `vite.config.ts` requires `PORT` and `BASE_PATH` env (use `BASE_PATH=/` locally). Its Replit plugins (`cartographer`, `dev-banner`) are already gated behind `REPL_ID !== undefined` and will auto-disable locally; `runtime-error-modal` runs unconditionally but is harmless. Removing all three `@replit/*` devDependencies is optional cleanup.
- **api-server**: `dev` script works as-is once env is loaded and `PORT` is set.

The old Replit port map for reference: metro 18115; other services used 8080–8083 and 20268. Locally just pick free ports; check `artifacts/photo-album/vite.config.ts` for a dev proxy to the API (if there is one, keep the API port in sync).

## Step 8 — Security cleanup (do this before pushing anywhere public)

- **`.replit` line 78 commits a real secret**: `BOOTSTRAP_ADMIN_SECRET = "tv-migrate-2026-collections"`. It's in git history. Generate a new value, put it only in `.env`, and treat the old one as burned (check what `BOOTSTRAP_ADMIN_SECRET` gates in the api-server routes before deciding how urgent rotation is).
- Generate fresh `SESSION_SECRET` and `AI_KEY_ENCRYPTION_SECRET`. Caution: if the Replit database had rows encrypted with the old `AI_KEY_ENCRYPTION_SECRET`, those can't be decrypted with a new one — fine for a fresh local DB.
- Confirm `.env` is gitignored before the first commit.

## Step 9 — Delete/keep Replit artifacts

Safe to delete once running locally:
- `.replit`, `.replitignore` — Replit runtime config
- `replit.md` — but **fold its Run & Operate section into a new `CLAUDE.md` first**; it's the only doc of the dev commands
- `.local/`, `.agents/`, `.config/`, `attached_assets/`, `artifacts/mockup-sandbox` (agent scratch/assets — skim for anything worth keeping first)
- `@replit/*` devDependencies in `artifacts/photo-album/package.json` and `artifacts/mockup-sandbox` + the plugin imports in their `vite.config.ts`

Keep: `health-check.sh` (generic smoke test, works against any URL), `scripts/` (check `scripts/src` for Replit assumptions).

## Step 10 — Verify

```sh
pnpm run typecheck                                 # all packages
pnpm run build                                     # typecheck + build
pnpm dev:api                                       # then: curl localhost:8080/<a known route>
pnpm dev:web                                       # open localhost:8081, sign in via Clerk, load an album (exercises DB + object storage)
pnpm --filter @workspace/api-server run test       # vitest
./health-check.sh http://localhost:8080            # smoke test critical routes
```

The end-to-end proof is uploading a photo in the web app: that exercises Clerk auth → API → Postgres → object storage → sharp thumbnailing in one flow.

## Later: deploying online

The Replit deployment was `autoscale` with `pnpm store prune` post-build (`.replit` `[deployment]`). Equivalent anywhere else:

- **Build**: `pnpm install --frozen-lockfile && pnpm run build`. The api-server bundles to `dist/index.mjs` via esbuild; run with `node --enable-source-maps dist/index.mjs`. Build photo-album with the production `BASE_PATH` and serve its `dist/` statically (either from the api-server or a CDN — check whether `api-server/src/app.ts` already serves static frontends; at time of writing it does not, so a static host or an added `express.static` is needed).
- **Host**: anything that runs Node + Postgres — Railway/Render/Fly give you both; or a VPS with Docker Compose (node + postgres + volume). Set all Step-2 env vars in the host's secret manager.
- **Clerk**: switch to production instance keys and configure the production domain in the Clerk dashboard (this is when `VITE_CLERK_PROXY_URL` / the clerkProxyMiddleware become relevant).
- **Mobile**: Expo builds ship through EAS, separate from the web deploy; the app needs the production API URL baked in via `EXPO_PUBLIC_*` env.

## Suggested execution order

Steps 1–3 get `typecheck` and the DB working with no code changes. Step 4 (object storage) is the only required code change to boot the API. Steps 5–6 are account setup + env. Step 7 makes it ergonomic. Steps 8–9 before the first public push. Don't start Step 9 cleanup until Step 10 passes.
