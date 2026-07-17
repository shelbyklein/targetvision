# TargetVision backlog

Open work is tracked in **GitHub Issues** → https://github.com/shelbyklein/targetvision/issues

To add new work, open an issue (templates live in `.github/ISSUE_TEMPLATE/`).
This file keeps the **Done** changelog below as a local, in-repo history.

## How to work it with Claude Code

In a Claude Code session in this repo, say one of:

- **"fix issue #12"** — Claude picks up that GitHub issue.
- **"work on the pagination issue"** — Claude finds it by name (`gh issue list`).
- **"triage the open issues"** — Claude reads them and proposes an order.

Claude will implement the change, verify it (`pnpm run typecheck` and
`pnpm run test` where relevant), open a PR that says **`Closes #N`** (so the
issue auto-closes on merge), and add a line to the **Done** changelog below.

## Open

Open items now live in **GitHub Issues** → https://github.com/shelbyklein/targetvision/issues
(`gh issue list` from the CLI). The eight items previously listed here were
migrated to issues #6–#13 on 2026-07-14.

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
- [x] 2026-07-14 (feat) Projects — a top-level "Projects" section (peer of Albums/Collections): user-curated buckets of photos. New `projects` + `project_photos` tables (migration `0002`), full CRUD + add/remove-photo API (`routes/projects.ts`), sidebar nav, list + detail pages (detail reuses `MasonryGrid`), and "Add to Project" controls on the photo detail page and lightbox. v1 = create/rename/delete + add/remove photos, ordered by date added. Verified end-to-end in the browser. Lightbox pill membership-state left as a follow-up.
- [x] 2026-07-14 (bug) Clicking a photo in a collection opened the photo page, not the lightbox — the collection detail grid now opens `PhotoLightbox` (with prev/next) like every other photo grid, instead of navigating to `/photos/:id`. Verified in the browser.
- [x] 2026-07-14 (feat) Show project membership on the lightbox "Add to Project" pills — the Photo response now carries a `photoProjects` field (mirroring `photoCollections`); lightbox pills show a filled check for projects the photo is already in and toggle add/remove. Covered by an integration test.
- [x] 2026-07-16 (feat) Merged lightbox action buttons into a single row (#66) — PhotoLightbox passes its view-details/download/not-applicable buttons into PhotoSidebarContent's actions row, so all icon actions share one flex row.
- [x] 2026-07-16 (feat) Collapsed lightbox collection pills to the top 5 (#67) — members always visible, AI-suggested first, remainder behind a "+N more" / "Show less" toggle.
- [x] 2026-07-16 (bug) Rating from search/smart collections no longer auto-advances (#68) — new advanceOnRate flag (default true) covers star clicks and keyboard digits; search and smart-collection lightboxes pass false, album review flows unchanged.
- [x] 2026-07-16 (feat) Photo page collections use toggle pills instead of a select (#69) — one pill cloud matching the lightbox (check = member/remove, sparkles = AI-suggested/add) with the same top-5 collapse; create form and Projects select unchanged.
- [x] 2026-07-16 (feat) Mobile album header polish (#72) — smaller title below the sm breakpoint, wrap-safe date/count/hidden stats, and a 2x2 action-button grid on phones.
- [x] 2026-07-16 (feat) Duplicates: admin summary + dedicated paginated page (#57) — the admin section is a counts-only card (with server-side "delete all extras"), and a new /admin/duplicates page reviews groups with limit/offset pagination, per-photo delete, and per-group delete-extras.
- [x] 2026-07-16 (chore) Dev environment: own database — dev runs against targetvision_dev (cloned from prod via scripts/clone-dev-db.ps1); PHOTO_STORAGE_DELETE_DISABLED guards the shared storage bucket from dev deletes; schema changes now flow dev-first, with migrations applied to prod at release.
- [x] 2026-07-16 (feat) Drag-to-reorder sidebar nav, per user (#63) — users.nav_order (migration 0009) + PATCH /users/me/nav-order; AppSidebar live-reorders during drag and persists on drop; Admin pinned last.
- [x] 2026-07-16 (feat) Admin hub + per-section pages (#76) — /admin is a queryless card grid; each section moved to its own /admin/<slug> page (shared AdminSectionShell), so library-wide status scans only run on the page you open.
- [x] 2026-07-16 (feat) Near-duplicates management page (#74) — paginated endpoint ({threshold, totalGroups, hasMore, groups}), page-size selector (default 20) + Load more, and checkbox bulk-select with a single confirm delete (covers excluded); no blanket delete action.
- [x] 2026-07-16 (feat) Infinite scroll on album detail + admin duplicates pages (#78) — bottom sentinel auto-loads the next page (Load more stays as fallback); fixed a latent useInfiniteScroll bug where the observer attached before the sentinel mounted (skeleton race) and never recovered.
- [x] 2026-07-17 (feat) Attribution tags — album-level usage rights (#80) — user-defined tags (USA Archery, World Archery, Social, …) managed at /admin/attribution-tags; the album page's tri-state Attribution pills tag/untag every photo in the album server-side (migration 0010); photos display read-only badges; "Any attribution" filters on album + Photos pages.
- [x] 2026-07-17 (feat) Project bulk download (#83) — GET /projects/:id/download streams a zip of the project's original photos from storage (archiver, store-level); "Bulk download" button on the project page.
- [x] 2026-07-17 (bug) Album card stats single-column on phones (#82) — stats stack one per line below sm with whitespace-nowrap; desktop two-column layout unchanged.
- [x] 2026-07-17 (feat) Smart collection cards with crossfading thumbnails (#86, #87) — collections list carries sampleThumbnailUrls (5 random member photos per request); Smart Collections page + dashboard render cards whose images crossfade every 4s (staggered, reduced-motion safe).
- [x] 2026-07-17 (feat) Bulk upload from an album page (#85) — album header "Bulk Upload" button links to /bulk-upload?albumId=N, which preselects that album as the destination.
- [x] 2026-07-17 (bug) Dark mode native controls — color-scheme: dark on the dark root; date-input calendar icon (and scrollbars) now render light instead of black-on-dark.
- [x] 2026-07-17 (feat) Smart collection view: members + semantic toggle (#94) — the page always shows the collection's own members first (green check), with an "Include semantic results" checkbox (default on) appending the ranked suggestions; unchecking skips the ranking query.
- [x] 2026-07-17 (feat) Smart collection thumbnails static until hover (#93) — cards load one random static image; the crossfade cycle only plays while hovering and holds on leave; reduced-motion stays static.
