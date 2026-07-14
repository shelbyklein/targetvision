import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  db,
  pool,
  usersTable,
  albumsTable,
  photosTable,
  collectionsTable,
  photoCollectionsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { listDuplicatePhotoGroups } from "../contentHash";

// Hard guard mirroring testDb.ts: the TRUNCATE below is destructive, so refuse
// to run against anything that is not obviously a test database.
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/test/i.test(dbUrl)) {
  throw new Error(
    `Refusing to run DB tests against a non-test database (DATABASE_URL=${dbUrl}). ` +
      `Set TEST_DATABASE_URL to a database whose name contains "test".`,
  );
}

let seq = 0;
const nextSeq = () => (seq += 1);

async function resetDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE photo_collections, collections, photos, albums, users RESTART IDENTITY CASCADE`,
  );
}

async function createUser() {
  const n = nextSeq();
  const [user] = await db
    .insert(usersTable)
    .values({ authUserId: `auth-${n}`, name: `User ${n}`, email: `user${n}@test.local`, role: "admin" })
    .returning();
  return user;
}

async function createAlbum(ownerId: number) {
  const [album] = await db.insert(albumsTable).values({ ownerId, title: "Album" }).returning();
  return album;
}

async function createPhoto(albumId: number, uploaderId: number, contentHash: string | null) {
  const n = nextSeq();
  const [photo] = await db
    .insert(photosTable)
    .values({
      albumId,
      uploaderId,
      url: `/api/storage/objects/uploads/${n}`,
      storageKey: `/objects/uploads/${n}`,
      filename: `photo-${n}.jpg`,
      contentHash,
    })
    .returning();
  return photo;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("listDuplicatePhotoGroups", () => {
  it("returns only groups with 2+ photos sharing a content hash", async () => {
    const user = await createUser();
    const album = await createAlbum(user.id);
    // Two photos share hash "aaa"; one unique "bbb"; one with NULL hash.
    await createPhoto(album.id, user.id, "aaa");
    await createPhoto(album.id, user.id, "aaa");
    await createPhoto(album.id, user.id, "bbb");
    await createPhoto(album.id, user.id, null);

    const groups = await listDuplicatePhotoGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].contentHash).toBe("aaa");
    expect(groups[0].photos).toHaveLength(2);
  });

  it("returns an empty array when there are no duplicates", async () => {
    const user = await createUser();
    const album = await createAlbum(user.id);
    await createPhoto(album.id, user.id, "unique-1");
    await createPhoto(album.id, user.id, "unique-2");

    expect(await listDuplicatePhotoGroups()).toEqual([]);
  });

  it("flags album covers and counts collection memberships", async () => {
    const user = await createUser();
    const album = await createAlbum(user.id);
    const cover = await createPhoto(album.id, user.id, "dup");
    const other = await createPhoto(album.id, user.id, "dup");

    // Mark `cover` as the album cover.
    await db.update(albumsTable).set({ coverPhotoId: cover.id }).where(eq(albumsTable.id, album.id));

    // Put `other` into two collections.
    const [c1] = await db.insert(collectionsTable).values({ createdById: user.id, title: "C1" }).returning();
    const [c2] = await db.insert(collectionsTable).values({ createdById: user.id, title: "C2" }).returning();
    await db.insert(photoCollectionsTable).values({ collectionId: c1.id, photoId: other.id });
    await db.insert(photoCollectionsTable).values({ collectionId: c2.id, photoId: other.id });

    const groups = await listDuplicatePhotoGroups();
    expect(groups).toHaveLength(1);

    const byId = new Map(groups[0].photos.map((p) => [p.id, p]));
    expect(byId.get(cover.id)!.isAlbumCover).toBe(true);
    expect(byId.get(cover.id)!.collectionCount).toBe(0);
    expect(byId.get(other.id)!.isAlbumCover).toBe(false);
    expect(byId.get(other.id)!.collectionCount).toBe(2);
  });
});
