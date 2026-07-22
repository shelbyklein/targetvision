import {
  db,
  usersTable,
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
    sql`TRUNCATE TABLE near_duplicate_pairs, photo_embeddings, ai_analysis_events, photo_collections, collection_negative_photos, project_photos, projects, collections, ratings, photo_attribution_tags, attribution_tags, photos, albums, organization_members, organizations, "user", session, account, verification, users RESTART IDENTITY CASCADE`,
  );
}

let seq = 0;
function nextSeq(): number {
  seq += 1;
  return seq;
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

export async function createAlbum(ownerId: number, title = "Test Album") {
  const [album] = await db.insert(albumsTable).values({ ownerId, title }).returning();
  return album;
}

export async function createPhoto(
  albumId: number,
  uploaderId: number,
  opts: { url?: string; aiDescription?: string | null; isHidden?: boolean; createdAt?: Date } = {},
) {
  const [photo] = await db
    .insert(photosTable)
    .values({
      albumId,
      uploaderId,
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

export async function createCollection(createdById: number, title = "Test Collection") {
  const [collection] = await db.insert(collectionsTable).values({ createdById, title }).returning();
  return collection;
}

export async function addPhotoToCollection(collectionId: number, photoId: number) {
  await db.insert(photoCollectionsTable).values({ collectionId, photoId });
}

export async function createProject(createdById: number, name = "Test Project") {
  const [project] = await db.insert(projectsTable).values({ createdById, name }).returning();
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
