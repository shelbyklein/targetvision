# Dev preview environment (`targetvisiondev.shelbyklein.com`)

A second copy of the app runs on this PC so you can preview any branch **without
touching the live site**. Prod stays on `main`; dev tracks whatever branch you
check out in a separate git worktree.

| | Prod (existing) | Dev (this) |
|---|---|---|
| Checkout | `C:\Vibes\Targetvision\Targetvision` (`main`) | `C:\Vibes\Targetvision\targetvision-dev` (worktree, any branch) |
| Web (Vite) | 8083 | **8085** |
| API | 8080 | **8084** |
| Database | `targetvision` @ 5433 | **same (shared)** |
| Object storage | fake-gcs @ 4443 | **same (shared)** |
| Public URL | targetvision.shelbyklein.com | **targetvisiondev.shelbyklein.com** |

Both stacks share the Postgres + fake-gcs containers (started by the prod
`scripts/start-targetvision.ps1`) and the same secrets, so dev renders the same
photos and your account works on both.

> ⚠️ **Shared database.** Dev is safe for **code / UI previews** only. Because it
> points at the **prod database and storage**, a schema push/migration or a
> destructive action (delete/edit) on dev hits **real prod data**. Never run
> `pnpm db push` / migrations against the shared DB from dev. To preview a
> branch that changes the schema, use the isolated-DB switch at the bottom.

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

### 2. Create the dev `.env`

The dev API binds its port from the worktree's own `.env`. Copy prod's env and
apply the dev overrides (use `.env.dev.example` in the repo root as the
reference for exactly which lines to change):

```sh
cp ../targetvision/.env .env
```

Then edit `.env` in the worktree so these lines read:

```
PORT=8084
BETTER_AUTH_URL=http://localhost:8084/api/auth
CORS_ORIGINS=http://localhost:8085,https://targetvisiondev.shelbyklein.com
TRUSTED_ORIGINS=http://localhost:8085,https://targetvisiondev.shelbyklein.com
```

Leave `DATABASE_URL`, `GCS_*`, `BETTER_AUTH_SECRET`, and
`AI_KEY_ENCRYPTION_SECRET` identical to prod (shared DB/storage + shared
sessions/AI keys).

### 3. Add the Cloudflare public hostname

The tunnel is dashboard-managed, so add the subdomain there (I can't change your
DNS/account):

1. Cloudflare **Zero Trust** → **Networks** → **Tunnels** → your tunnel → **Public Hostname** → **Add a public hostname**.
2. Subdomain `targetvisiondev`, domain `shelbyklein.com`.
3. Service: **HTTP** → `host.docker.internal:8085`.
   The `cloudflared` for this tunnel runs **inside a Docker container**
   (`homechart-cloudflared-1`, token-managed), so from its perspective the host's
   port 8085 is `host.docker.internal:8085` — **not** `localhost:8085` (that would
   point at the container itself). Tip: open the existing `targetvision` public
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

or run `scripts/start-targetvision-dev.ps1` (starts both if the ports are free;
does **not** touch Docker or the DB).

Then open `http://localhost:8085` locally, or
`https://targetvisiondev.shelbyklein.com` once the hostname is added. Sign in
again on the dev origin (same account, separate cookie host). Prod at
`targetvision.shelbyklein.com` is unaffected.

**Stop the dev stack:** kill the two `node`/`vite` processes on 8084/8085 (e.g.
close their windows, or `Get-NetTCPConnection -LocalPort 8085,8084 -State Listen`
→ `Stop-Process`).

## Previewing a schema change (isolated DB)

When a branch changes the Drizzle schema, do **not** run it against the shared
prod DB. Point dev at an isolated database first:

```sh
createdb targetvision_dev    # once (or the SQL equivalent on 5433)
```

In the worktree `.env`, switch `DATABASE_URL` to the dev DB:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5433/targetvision_dev
```

Then apply the branch's migrations to that DB only:

```sh
pnpm --filter @workspace/db run migrate
```

Now dev runs against its own database and can no longer affect prod data. (Note:
an isolated DB starts empty — you'll need to seed or re-upload test photos, and
the shared fake-gcs bucket won't match its rows.)
