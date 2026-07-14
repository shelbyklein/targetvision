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

- [ ] (feat) Near-duplicate detection (follow-up) — extend duplicate detection with a perceptual/dHash column + threshold grouping to catch re-encoded/resized copies, not just byte-identical ones. [priority: low]

- [ ] (feat) Server-side pagination for the main Photos page and Search — right now `/photos` and `/search` return every matching photo; add limit/offset (contract + frontend change). [priority: low]
- [ ] (feat) Use full window width on desktop — remove the centered max-width container so page content spans edge to edge on large screens, using the full window space. [priority: low]
- [ ] (bug) Album card metadata text too large — the photo count, date, and other metadata below album titles on the Albums page should use a smaller text size. [priority: low]
- [ ] (chore) Decompose the remaining large pages — `photo-detail.tsx` (~1000 lines), `bulk-upload.tsx`, and `PhotoLightbox.tsx` into smaller components. [priority: low]
- [ ] (chore) Finish removing Replit leftovers in the mobile app — `artifacts/mobile/scripts/build.js`, `dev-start.mjs`, and `app.json` still reference Replit. [priority: low]

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
