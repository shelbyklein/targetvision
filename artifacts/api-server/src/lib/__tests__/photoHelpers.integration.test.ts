import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { pool } from "@workspace/db";
import { buildPhotosResponse, fetchAlbumPhotoPage } from "../photoHelpers";
import {
  resetDb,
  createUser,
  createOrganization,
  createAlbum,
  createPhoto,
  ratePhoto,
  createCollection,
  addPhotoToCollection,
  createProject,
  addPhotoToProject,
  addAiEvent,
} from "./testDb";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe("buildPhotosResponse (batched, N+1-free)", () => {
  it("returns objects in the requested id order and drops missing ids", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const album = await createAlbum(user.id, "Test Album", org.id);
    const p1 = await createPhoto(album.id, user.id, { organizationId: org.id });
    const p2 = await createPhoto(album.id, user.id, { organizationId: org.id });
    const p3 = await createPhoto(album.id, user.id, { organizationId: org.id });

    const result = await buildPhotosResponse([p3.id, p1.id, 99999, p2.id], org.id, user.id);

    expect(result.map((r) => r!.id)).toEqual([p3.id, p1.id, p2.id]);
  });

  it("aggregates ratings, myRating, collections and latest AI status correctly", async () => {
    const org = await createOrganization();
    const owner = await createUser();
    const other = await createUser();
    const album = await createAlbum(owner.id, "Test Album", org.id);
    const p1 = await createPhoto(album.id, owner.id, { organizationId: org.id });
    const p2 = await createPhoto(album.id, owner.id, { organizationId: org.id });

    // p1: two ratings (5 by owner, 3 by other) -> avg 4, count 2.
    await ratePhoto(p1.id, owner.id, 5);
    await ratePhoto(p1.id, other.id, 3);

    // p2 belongs to a collection.
    const collection = await createCollection(owner.id, "Highlights", org.id);
    await addPhotoToCollection(collection.id, p2.id);

    // p2 also belongs to a project (p1 belongs to none).
    const project = await createProject(owner.id, "Summer Campaign", org.id);
    await addPhotoToProject(project.id, p2.id);

    // p1's latest AI event is success (older failed, newer success).
    await addAiEvent(p1.id, "failed", { createdAt: new Date("2024-01-01T00:00:00Z") });
    await addAiEvent(p1.id, "success", { createdAt: new Date("2024-06-01T00:00:00Z") });

    const [r1, r2] = await buildPhotosResponse([p1.id, p2.id], org.id, owner.id);

    expect(r1!.averageRating).toBe(4);
    expect(r1!.ratingCount).toBe(2);
    expect(r1!.myRating).toBe(5);
    expect(r1!.ratings).toHaveLength(2);
    expect(r1!.latestAiStatus).toBe("success");

    expect(r2!.averageRating).toBeNull();
    expect(r2!.ratingCount).toBe(0);
    expect(r2!.myRating).toBeNull();
    expect(r2!.photoCollections).toHaveLength(1);
    expect(r2!.photoCollections[0].title).toBe("Highlights");

    // Project membership is reported on photoProjects (p1 has none, p2 has one).
    expect(r1!.photoProjects).toHaveLength(0);
    expect(r2!.photoProjects).toHaveLength(1);
    expect(r2!.photoProjects[0].name).toBe("Summer Campaign");
  });

  it("drops photos that belong to a different organization", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const user = await createUser();
    const albumA = await createAlbum(user.id, "A", orgA.id);
    const albumB = await createAlbum(user.id, "B", orgB.id);
    const mine = await createPhoto(albumA.id, user.id, { organizationId: orgA.id });
    const theirs = await createPhoto(albumB.id, user.id, { organizationId: orgB.id });

    // Asking as orgA must never surface orgB's photo, even with its id in hand.
    const result = await buildPhotosResponse([mine.id, theirs.id], orgA.id, user.id);
    expect(result.map((r) => r!.id)).toEqual([mine.id]);
  });

  it("returns an empty array for an empty id list without querying", async () => {
    expect(await buildPhotosResponse([], 1)).toEqual([]);
  });
});

describe("fetchAlbumPhotoPage (SQL filtering + pagination)", () => {
  // Helper to seed N photos with strictly increasing createdAt so DESC order is
  // deterministic (last created first).
  async function seedOrderedAlbum(count: number) {
    const org = await createOrganization();
    const user = await createUser();
    const album = await createAlbum(user.id, "Test Album", org.id);
    const photos = [];
    for (let i = 0; i < count; i++) {
      photos.push(
        await createPhoto(album.id, user.id, {
          organizationId: org.id,
          createdAt: new Date(`2024-01-0${i + 1}T00:00:00Z`),
        }),
      );
    }
    return { org, user, album, photos };
  }

  it("paginates in created_at DESC order and reports hasMore", async () => {
    const { org, album, photos } = await seedOrderedAlbum(5);
    const desc = [...photos].reverse(); // newest first

    const page1 = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, limit: 2, offset: 0 });
    expect(page1.ids).toEqual([desc[0].id, desc[1].id]);
    expect(page1.hasMore).toBe(true);

    const page2 = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, limit: 2, offset: 2 });
    expect(page2.ids).toEqual([desc[2].id, desc[3].id]);
    expect(page2.hasMore).toBe(true);

    const page3 = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, limit: 2, offset: 4 });
    expect(page3.ids).toEqual([desc[4].id]);
    expect(page3.hasMore).toBe(false);
  });

  it("hides hidden photos unless canSeeHidden is set", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const album = await createAlbum(user.id, "Test Album", org.id);
    const visible = await createPhoto(album.id, user.id, { organizationId: org.id });
    const hidden = await createPhoto(album.id, user.id, { organizationId: org.id, isHidden: true });

    const asMember = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, limit: 50, offset: 0 });
    expect(asMember.ids).toEqual([visible.id]);

    const asAdmin = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: true, limit: 50, offset: 0 });
    expect(asAdmin.ids).toContain(hidden.id);
    expect(asAdmin.ids).toContain(visible.id);
  });

  it("filters by inCollection membership", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const album = await createAlbum(user.id, "Test Album", org.id);
    const inColl = await createPhoto(album.id, user.id, { organizationId: org.id });
    const notInColl = await createPhoto(album.id, user.id, { organizationId: org.id });
    const collection = await createCollection(user.id, "Test Collection", org.id);
    await addPhotoToCollection(collection.id, inColl.id);

    const yes = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, inCollection: true, limit: 50, offset: 0 });
    expect(yes.ids).toEqual([inColl.id]);

    const no = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, inCollection: false, limit: 50, offset: 0 });
    expect(no.ids).toEqual([notInColl.id]);
  });

  it("filters by hasRating", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const album = await createAlbum(user.id, "Test Album", org.id);
    const rated = await createPhoto(album.id, user.id, { organizationId: org.id });
    const unrated = await createPhoto(album.id, user.id, { organizationId: org.id });
    await ratePhoto(rated.id, user.id, 4);

    const yes = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, hasRating: true, limit: 50, offset: 0 });
    expect(yes.ids).toEqual([rated.id]);

    const no = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, hasRating: false, limit: 50, offset: 0 });
    expect(no.ids).toEqual([unrated.id]);
  });

  it("filters by aiStatus (has_description / not_analysed / failed)", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const album = await createAlbum(user.id, "Test Album", org.id);
    const described = await createPhoto(album.id, user.id, { organizationId: org.id, aiDescription: "a cat" });
    const failed = await createPhoto(album.id, user.id, { organizationId: org.id });
    const untouched = await createPhoto(album.id, user.id, { organizationId: org.id });

    // `failed` has an older success then a newer failed -> latest is failed.
    await addAiEvent(failed.id, "success", { createdAt: new Date("2024-01-01T00:00:00Z") });
    await addAiEvent(failed.id, "failed", { createdAt: new Date("2024-02-01T00:00:00Z") });

    const hasDesc = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, aiStatus: "has_description", limit: 50, offset: 0 });
    expect(hasDesc.ids).toEqual([described.id]);

    const notAnalysed = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, aiStatus: "not_analysed", limit: 50, offset: 0 });
    expect(notAnalysed.ids.sort()).toEqual([described.id, untouched.id].sort());

    const failedOnly = await fetchAlbumPhotoPage(album.id, { organizationId: org.id, canSeeHidden: false, aiStatus: "failed", limit: 50, offset: 0 });
    expect(failedOnly.ids).toEqual([failed.id]);
  });
});
