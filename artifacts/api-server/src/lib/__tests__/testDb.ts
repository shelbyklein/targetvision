import {
  db,
  usersTable,
  organizationsTable,
  organizationMembersTable,
  albumsTable,
  photosTable,
  ratingsTable,
  collectionsTable,
  photoCollectionsTable,
  projectsTable,
  projectPhotosTable,
  aiAnalysisEventsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

// Hard guard: the reset below is destructive (TRUNCATE), so refuse to run
// against anything that is not obviously a test database.
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/test/i.test(dbUrl)) {
  throw new Error(
    `Refusing to run DB tests against a non-test database (DATABASE_URL=${dbUrl}). ` +
      `Set TEST_DATABASE_URL to a database whose name contains "test".`,
  );
}

export async function resetDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE near_duplicate_pairs, photo_embeddings, ai_analysis_events, photo_collections, collection_negative_photos, project_photos, projects, collections, ratings, photo_attribution_tags, attribution_tags, photos, albums, organization_invites, organization_subscriptions, organization_settings, organization_members, organizations, "user", session, account, verification, users RESTART IDENTITY CASCADE`,
  );
  cachedOrgId = null;
}

let seq = 0;
function nextSeq(): number {
  seq += 1;
  return seq;
}

// A lazily-created default org so factories that don't care about tenancy still
// satisfy the now-required organization_id. Reset per resetDb().
let cachedOrgId: number | null = null;
async function ensureDefaultOrg(): Promise<number> {
  if (cachedOrgId != null) return cachedOrgId;
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: "Default Test Org", slug: `default-test-org-${nextSeq()}` })
    .returning();
  cachedOrgId = org.id;
  return cachedOrgId;
}

export async function createUser(opts: { name?: string; role?: "admin" | "member" } = {}) {
  const n = nextSeq();
  const [user] = await db
    .insert(usersTable)
    .values({
      authUserId: `auth-user-${n}`,
      name: opts.name ?? `User ${n}`,
      email: `user${n}@test.local`,
      role: opts.role ?? "member",
    })
    .returning();
  return user;
}

// Multi-tenant test helpers (issue #113).
export async function createOrganization(opts: { name?: string; slug?: string } = {}) {
  const n = nextSeq();
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: opts.name ?? `Org ${n}`, slug: opts.slug ?? `org-${n}` })
    .returning();
  return org;
}

export async function addOrganizationMember(
  organizationId: number,
  userId: number,
  role: "owner" | "admin" | "member" = "member",
) {
  await db.insert(organizationMembersTable).values({ organizationId, userId, role });
}

export async function createAlbum(ownerId: number, title = "Test Album", organizationId?: number) {
  const orgId = organizationId ?? (await ensureDefaultOrg());
  const [album] = await db.insert(albumsTable).values({ ownerId, title, organizationId: orgId }).returning();
  return album;
}

export async function createPhoto(
  albumId: number,
  uploaderId: number,
  opts: {
    url?: string;
    aiDescription?: string | null;
    isHidden?: boolean;
    createdAt?: Date;
    organizationId?: number;
  } = {},
) {
  const [photo] = await db
    .insert(photosTable)
    .values({
      albumId,
      uploaderId,
      organizationId: opts.organizationId ?? (await ensureDefaultOrg()),
      url: opts.url ?? `/api/storage/objects/uploads/${nextSeq()}`,
      aiDescription: opts.aiDescription ?? null,
      isHidden: opts.isHidden ?? false,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    })
    .returning();
  return photo;
}

export async function ratePhoto(photoId: number, userId: number, score: number) {
  await db.insert(ratingsTable).values({ photoId, userId, score });
}

export async function createCollection(createdById: number, title = "Test Collection", organizationId?: number) {
  const orgId = organizationId ?? (await ensureDefaultOrg());
  const [collection] = await db
    .insert(collectionsTable)
    .values({ createdById, title, organizationId: orgId })
    .returning();
  return collection;
}

export async function addPhotoToCollection(collectionId: number, photoId: number) {
  await db.insert(photoCollectionsTable).values({ collectionId, photoId });
}

export async function createProject(createdById: number, name = "Test Project", organizationId?: number) {
  const orgId = organizationId ?? (await ensureDefaultOrg());
  const [project] = await db
    .insert(projectsTable)
    .values({ createdById, name, organizationId: orgId })
    .returning();
  return project;
}

export async function addPhotoToProject(projectId: number, photoId: number) {
  await db.insert(projectPhotosTable).values({ projectId, photoId });
}

export async function addAiEvent(
  photoId: number,
  status: "success" | "skipped" | "failed",
  opts: { createdAt?: Date } = {},
) {
  await db.insert(aiAnalysisEventsTable).values({
    photoId,
    status,
    provider: "test",
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
}
