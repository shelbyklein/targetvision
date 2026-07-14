# TargetVision backlog

The simple issue tracker for this project — no GitHub required. Add anything
that needs doing under **Open**. Keep entries short; a title and a sentence is
enough.

## How to work it with Claude Code

In a Claude Code session in this repo, say one of:

- **"fix the top item in BACKLOG.md"** — Claude takes the first open item.
- **"work on the login bug in BACKLOG.md"** — Claude picks the one you name.
- **"triage BACKLOG.md"** — Claude reads everything and proposes an order.

Claude will implement the change, verify it (`pnpm run typecheck` and
`pnpm run test` where relevant), then check the item off and move it to **Done**
with today's date.

Tip: even without GitHub, run `git commit` after each fix as your undo button —
one command, all local, no pushing. That way any change can be rolled back.

## Format

```
- [ ] (bug|feat|chore) Short title — one line of detail. [priority: high|low]
```

## Open

- [ ] (feat) Add a top-level "Projects" section — a new primary destination (peer of Albums and Collections) where a user gathers/curates specific images for use in an actual document, as opposed to browsing/searching the library for options. [priority: high]
  - Concept: a Project is a user-curated *bucket* of chosen photos (think "shortlist for a deliverable") — curation is the whole scope. No export/output/"use these" step. Distinct from Albums (storage/ownership) and Smart Collections (keyword-driven auto-groupings). Photos can live in a Project regardless of which album they belong to, and in more than one project.
  - Nav: add "Projects" to the left sidebar at the same level as Albums/Collections, with its own list page and detail page.
  - Data/API: new `projects` table (name, description, timestamps) + a project↔photo join (many-to-many); CRUD endpoints; add/remove photo to/from a project. Update OpenAPI spec + regenerate codegen.
  - UI: a Projects list page (cards), a Project detail page showing the curated photos (reuse the MasonryGrid), and an "Add to Project" action from photo cards / the lightbox (like adding to a collection).
  - v1 scope: create/rename/delete projects + add/remove photos. Ordering within a project = by date added (manual reorder deferred). No export.

- [ ] (feat) Near-duplicate detection (follow-up) — extend duplicate detection with a perceptual/dHash column + threshold grouping to catch re-encoded/resized copies, not just byte-identical ones. [priority: low]

- [ ] (feat) Server-side pagination for the main Photos page and Search — right now `/photos` and `/search` return every matching photo; add limit/offset (contract + frontend change). [priority: low]
- [ ] (feat) Use full window width on desktop — remove the centered max-width container so page content spans edge to edge on large screens, using the full window space. [priority: low]
- [ ] (bug) Album card metadata text too large — the photo count, date, and other metadata below album titles on the Albums page should use a smaller text size. [priority: low]
- [ ] (chore) Decompose the remaining large pages — `photo-detail.tsx` (~1000 lines), `bulk-upload.tsx`, and `PhotoLightbox.tsx` into smaller components. [priority: low]
- [ ] (chore) Finish removing Replit leftovers in the mobile app — `artifacts/mobile/scripts/build.js`, `dev-start.mjs`, and `app.json` still reference Replit. [priority: low]
- [ ] (chore) Backfill missing photo indexes on baselined DBs — the four indexes added in migration `0000` (`photos_album_created_idx`, `photos_created_idx`, `photos_uploader_idx`, `photos_taken_at_idx`) only get created on fresh DBs; DBs baselined against `0000` never ran them. Add a `0002` migration with `CREATE INDEX IF NOT EXISTS` so existing dev/prod DBs get them. Perf-only, not correctness. [priority: low]

## Done

<!-- Claude moves finished items here, e.g.:
- [x] 2026-07-09 (bug) Lightbox image never loaded — lazy images no longer starve the image queue.
-->

- [x] 2026-07-09 (feat) Move header nav to a collapsible left sidebar — replaced the top header with a shadcn `Sidebar`-based left nav (icon-rail collapse, cookie-persisted state, mobile drawer) in `AppLayout.tsx`; all prior nav items preserved.
- [x] 2026-07-09 (feat) Simplify smart collection display — smart-collection cards now render a single keyword/title pill (shared `Badge`), dropping thumbnails and descriptions, on both the Smart Collections page and the dashboard section.
- [x] 2026-07-09 (chore) Standardize date formatting to "Jan 04, 2026" — added a shared `formatDate`/`formatDateTime` helper (`src/lib/format-date.ts`, via date-fns) and routed all user-facing date displays through it across web pages/admin sections plus the mobile album card.
- [x] 2026-07-09 (bug) "Review Unrated" count only reflects loaded photos — album response now returns a server-computed `unratedCount` (non-hidden photos with zero ratings); the button shows the true album-wide total instead of the ~50-cap client-side count.
- [x] 2026-07-09 (bug) Masonry grid fills column-by-column — new shared `MasonryGrid` distributes items round-robin into column buckets (item i → column i % N) for true left-to-right reading order, responsive across breakpoints; applied to all six photo grids.
- [x] 2026-07-09 (feat) Duplicate detection & cleanup (exact) — added a `contentHash` (SHA-256) column + migration, hashing on upload, a background backfill, an admin-only duplicate-groups endpoint, and an admin "Duplicates" section that reuses the existing photo-delete path; album-cover photos are delete-disabled and collection membership is warned. Near-duplicate/perceptual hashing left as a follow-up.
