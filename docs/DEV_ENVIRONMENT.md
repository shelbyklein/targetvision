# Dev preview environment (`vispixdev.shelbyklein.com`)

A second copy of the app runs on this PC so you can preview any branch **without
touching the live site**. Prod stays on `main`; dev tracks whatever branch you
check out in a separate git worktree.

| | Prod (existing) | Dev (this) |
|---|---|---|
| Checkout | `C:\Vibes\Targetvision\Targetvision` (`main`) | `C:\Vibes\Targetvision\targetvision-dev` (worktree, any branch) |
| Web (Vite) | 8083 | **8085** |
| API | 8080 | **8084** |
| Database | `vispix` @ 5433 | **`vispix_dev` @ 5433** (cloned from prod) |
| Object storage | fake-gcs @ 4443 | same bucket (deletes disabled — see below) |
| Public URL | vispix.shelbyklein.com | **vispixdev.shelbyklein.com** |

Both stacks share the Postgres + fake-gcs containers (started by the prod
`scripts/start-vispix.ps1`) and the same secrets. Dev has its **own
database**, snapshot-cloned from prod (photos, users, sessions and all), so it
renders the same library and your account works on both — but **schema changes,
migrations, and destructive testing on dev are completely safe**: they only
touch `vispix_dev`.

> ⚠️ **One shared piece remains: the storage bucket.** Dev's photo rows reference
> the same image objects as prod's, so the dev API runs with
> `PHOTO_STORAGE_DELETE_DISABLED=true` — deleting a photo on dev removes the dev
> DB row but leaves the image file alone. Keep that flag set in the dev `.env`.
> (Photos *uploaded* on dev create new objects prod never references; those are
> only cleaned up by a dev delete's skipped storage pass, i.e. never — an
> acceptable leak for a dev box.)

## One-time setup

### 1. Create the dev worktree

From the prod checkout (`C:\Vibes\Targetvision\Targetvision`):

```sh
# `main` is already checked out in the prod worktree, so create the dev worktree
# detached at main's commit; you'll check out feature branches into it later.
git worktree add --detach ../targetvision-dev main
cd ../targetvision-dev
pnpm install
```

### 2. Create the dev database

Clone prod into `vispix_dev` (also how you refresh dev data later):

```powershell
scripts\clone-dev-db.ps1
```

### 3. Create the dev `.env`

The dev API binds its port from the worktree's own `.env`. Copy prod's env and
apply the dev overrides (use `.env.dev.example` in the repo root as the
reference for exactly which lines to change):

```sh
cp ../targetvision/.env .env
```

Then edit `.env` in the worktree so these lines read:

```
PORT=8084
DATABASE_URL=postgres://postgres:postgres@localhost:5433/vispix_dev
BETTER_AUTH_URL=http://localhost:8084/api/auth
CORS_ORIGINS=http://localhost:8085,https://vispixdev.shelbyklein.com
TRUSTED_ORIGINS=http://localhost:8085,https://vispixdev.shelbyklein.com
PHOTO_STORAGE_DELETE_DISABLED=true
```

Leave `GCS_*`, `BETTER_AUTH_SECRET`, and `AI_KEY_ENCRYPTION_SECRET` identical to
prod (shared storage + the cloned sessions/AI keys must still validate).

### 4. Add the Cloudflare public hostname

The tunnel is dashboard-managed, so add the subdomain there (I can't change your
DNS/account):

1. Cloudflare **Zero Trust** → **Networks** → **Tunnels** → your tunnel → **Public Hostname** → **Add a public hostname**.
2. Subdomain `vispixdev`, domain `shelbyklein.com`.
3. Service: **HTTP** → `host.docker.internal:8085`.
   The `cloudflared` for this tunnel runs **inside a Docker container**
   (`homechart-cloudflared-1`, token-managed), so from its perspective the host's
   port 8085 is `host.docker.internal:8085` — **not** `localhost:8085` (that would
   point at the container itself). Tip: open the existing `vispix` public
   hostname to see exactly what host reference the prod entry uses for port 8083,
   and copy it verbatim with `8085`.
4. Save. Cloudflare auto-creates the DNS record.

## Branch workflow (dev → main releases)

Day-to-day work lives on the long-running **`dev` branch**, which this worktree
keeps checked out — the dev site always shows it. `main` is the release line:
the prod checkout stays on it, and the live site serves it.

- **Work:** commit directly to `dev` (or merge short feature branches into it).
  The dev web server HMRs each commit; **API changes need a dev API restart**
  (kill port 8084, re-run `pnpm run dev:api` here).
- **Release** (at a good release point): PR `dev` → `main`, merge with a
  **merge commit** (not squash, so the next release PR diffs cleanly), then in
  the prod checkout `git pull` — and restart the prod API if api-server code
  changed (web updates via HMR).

## Daily use

**Preview a branch:**

```sh
cd C:\Vibes\Targetvision\targetvision-dev
git fetch origin
git checkout <branch>        # e.g. feat/some-thing
pnpm install                 # only if deps changed
```

**Start the dev stack** (from the worktree):

```sh
pnpm run dev:api             # API on 8084 (reads this worktree's .env)
pnpm run dev:web:dev         # web on 8085, proxies /api -> 8084
```

or run `scripts/start-vispix-dev.ps1` (starts both if the ports are free;
does **not** touch Docker or the DB).

Then open `http://localhost:8085` locally, or
`https://vispixdev.shelbyklein.com` once the hostname is added. Sign in
again on the dev origin (same account, separate cookie host). Prod at
`vispix.shelbyklein.com` is unaffected.

**Stop the dev stack:** kill the two `node`/`vite` processes on 8084/8085 (e.g.
close their windows, or `Get-NetTCPConnection -LocalPort 8085,8084 -State Listen`
→ `Stop-Process`).

## Schema changes on dev

Dev owns `vispix_dev`, so the normal workflow just works here:

```sh
# in the dev worktree, after editing lib/db/src/schema/*
pnpm --filter @workspace/db run generate    # writes the migration
pnpm --filter @workspace/db run migrate     # applies it to vispix_dev
# restart the dev API (kill port 8084, re-run scripts/start-vispix-dev.ps1)
```

**At release**, after merging `dev` → `main` and pulling in the prod checkout,
apply the same migrations to prod:

```sh
# in the PROD checkout
pnpm --filter @workspace/db run migrate     # applies pending migrations to vispix
# restart the prod API
```

## Refreshing dev data (re-clone from prod)

Dev's data is a point-in-time snapshot; prod moves on without it. To resync:

```powershell
scripts\clone-dev-db.ps1
```

Drops and recreates `vispix_dev` from a fresh prod dump (prod is only
read). If the dev branch carries migrations prod doesn't have yet, re-run
`pnpm --filter @workspace/db run migrate` in the worktree afterwards.
