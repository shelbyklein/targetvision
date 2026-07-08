# TargetVision

A pnpm-workspace monorepo photo album app: Express API + React web frontend + Expo mobile app, backed by Postgres/Drizzle, Better Auth (email/password), fake-gcs-server object storage (GCS-compatible), and pluggable AI providers (OpenAI/Anthropic/Gemini) for photo analysis. Everything runs locally — no cloud accounts required.

## Run & Operate

- `pnpm run dev` — start storage (docker compose) + API (port 8080) + web (port 8081)
- `pnpm run dev:api` / `pnpm run dev:web` / `pnpm run dev:storage` — run pieces individually
- `pnpm run dev:mobile` — run the Expo mobile app (`expo start`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Prerequisites: Node 24 (nvm), pnpm (corepack), PostgreSQL 16 on port 5433 (brew services), Docker Desktop (for fake-gcs-server)
- Env vars load from a root `.env` file (see `.env.example`). The api-server reads it via `--env-file-if-exists`; `lib/db`'s `push`/`seed` scripts use `dotenv-cli` (`dotenv -e ../../.env -- <cmd>`).

## Auth (Better Auth)

- Config: `artifacts/api-server/src/lib/auth.ts` (better-auth pinned exact — see api-server/photo-album package.json; keep both in sync). Handler mounted in `app.ts` at `/api/auth/*splat` **before** `express.json()` (it reads the raw body).
- Sessions are cookies stored in Postgres (`user`/`session`/`account`/`verification` tables, schema in `lib/db/src/schema/auth.ts`, generated via `@better-auth/cli generate`).
- App users live in the separate `users` table, soft-linked by `authUserId`; `requireAuth` auto-provisions on first sign-in. **The first user ever to sign up gets role "admin"**; everyone after is "member".
- The admin registration toggle is enforced server-side by a `databaseHooks.user.create.before` hook (403 on sign-up when disabled).
- Frontend: `artifacts/photo-album/src/lib/auth-client.ts` (better-auth/react), `AuthGate` component gates routes, sign-in/sign-up pages at `src/pages/sign-in.tsx` / `sign-up.tsx`.

## Object storage (fake-gcs-server)

- `docker compose up -d` runs fsouza/fake-gcs-server on port 4443; the `targetvision` bucket is auto-created from `scripts/fake-gcs/seed/`. Objects persist in a named volume.
- `artifacts/api-server/src/lib/objectStorage.ts`: when `GCS_ENDPOINT` is set, the GCS client points at the emulator and signs URLs with an ephemeral RSA key generated at boot (fake-gcs-server never validates signatures). Unset `GCS_ENDPOINT` → real GCS via ADC.
- Browser uploads: `POST /api/storage/uploads/request-url` rewrites the signed URL onto the `/gcs` Vite proxy path when `GCS_BROWSER_UPLOAD_PREFIX` is set, keeping uploads same-origin (no CORS against the emulator). Server-side callers (thumbnails) use absolute signed URLs directly.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (API bundles to `dist/index.mjs`)
- Auth: Better Auth
- Object storage: Google Cloud Storage API (fake-gcs-server locally)

## Where things live

| Package | Path | What it is |
|---|---|---|
| `@workspace/api-server` | `artifacts/api-server` | Express 5 API |
| `@workspace/photo-album` | `artifacts/photo-album` | Vite + React web frontend |
| `@workspace/mobile` | `artifacts/mobile` | Expo / React Native app (no auth wired yet) |
| `lib/db` | `lib/db` | Drizzle schema + `drizzle-kit push` + seed |
| `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` | `lib/*` | OpenAPI spec + Orval-generated Zod schemas and React Query hooks |

## Gotchas

- The API routes rely on `lib/api-spec/openapi.yaml` staying in sync with route/DB code — if you add a query param or body field to a route, add it to the OpenAPI spec and re-run `pnpm --filter @workspace/api-spec run codegen`, or the generated Zod schemas and TypeScript types will silently drift.
- Better Auth is externalized in the api-server esbuild bundle's `@opentelemetry/*` pattern — `@opentelemetry/semantic-conventions` must stay an explicit api-server dependency or the bundle fails at boot. Do NOT add `@opentelemetry/api` as a direct dep: it forks drizzle-orm into two peer-variant instances and breaks typecheck.
- Seed users (`lib/db/src/seed.ts`) have no Better Auth account rows and can't sign in — they only anchor demo data. Don't seed before the first real sign-up if you want that account to get the first-user admin grant.
- `lib/object-storage-web/tsconfig.json` needs `"composite": true` since `artifacts/photo-album` references it as a TS project reference.
- Known pre-existing typecheck failures (2 in photo-album, 0 in api-server/mobile): dual-`@types/react` (19.1.x pinned by mobile vs 19.2.x catalog) type conflicts in `calendar.tsx`/`spinner.tsx`. Fixing means realigning mobile's pinned React types, which risks breaking Expo compatibility — needs its own investigation. (The previous ~69-error count was `openapi.yaml` drift from the generated api-zod/api-client-react packages not having been regenerated since the Better Auth migration — running codegen and syncing the spec resolved it.)
- Vite dev server proxies `/api` → API server and `/gcs` → fake-gcs-server (`artifacts/photo-album/vite.config.ts`).
