import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock Better Auth so a request authenticates as whichever user's authUserId it
// sends in the x-test-auth-user header (see `api()` below). The real session
// machinery (cookies/DB) isn't exercised here — this suite is about org scoping.
vi.mock("../auth", () => ({
  auth: {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get("x-test-auth-user");
        return id ? { user: { id } } : null;
      },
    },
    // app.ts mounts toNodeHandler(auth); tests never hit /api/auth, but the
    // handler must exist for the mount to succeed.
    handler: async () => new Response(null, { status: 404 }),
  },
}));

import type { Server } from "node:http";
import app from "../../app";
import { mayAccessObjectPath } from "../../routes/storage";
import { db, pool, assetsTable, attributionTagsTable } from "@workspace/db";
import {
  resetDb,
  createUser,
  createOrganization,
  addOrganizationMember,
  createAlbum,
  createPhoto,
  createCollection,
  createProject,
} from "./testDb";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

async function api(
  path: string,
  opts: { user?: { authUserId: string }; orgId?: number; method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.user) headers["x-test-auth-user"] = opts.user.authUserId;
  if (opts.orgId != null) headers["x-organization-id"] = String(opts.orgId);
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return fetch(`${baseUrl}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

// Two fully-populated tenants; user A belongs only to org A, user B only to B.
async function seedTwoOrgs() {
  const orgA = await createOrganization({ name: "Org A", slug: "org-a" });
  const orgB = await createOrganization({ name: "Org B", slug: "org-b" });
  const userA = await createUser({ name: "Alice" });
  const userB = await createUser({ name: "Bob" });
  await addOrganizationMember(orgA.id, userA.id, "owner");
  await addOrganizationMember(orgB.id, userB.id, "owner");

  async function populate(orgId: number, ownerId: number, tag: string) {
    const album = await createAlbum(ownerId, `${tag} album`, orgId);
    const photo = await createPhoto(album.id, ownerId, { organizationId: orgId });
    const collection = await createCollection(ownerId, `${tag} collection`, orgId);
    const project = await createProject(ownerId, `${tag} project`, orgId);
    const [asset] = await db
      .insert(assetsTable)
      .values({ kind: "brand", name: `${tag} asset`, storageKey: "/objects/x", contentType: "image/png", organizationId: orgId, createdById: ownerId })
      .returning();
    const [attr] = await db
      .insert(attributionTagsTable)
      .values({ name: `${tag}-rights`, organizationId: orgId })
      .returning();
    return { album, photo, collection, project, asset, attr };
  }

  const a = await populate(orgA.id, userA.id, "A");
  const b = await populate(orgB.id, userB.id, "B");
  return { orgA, orgB, userA, userB, a, b };
}

beforeEach(async () => {
  await resetDb();
});

describe("org isolation — a member of org A cannot reach org B's data", () => {
  it("blocks a non-member from acting in an org (403) but allows a member", async () => {
    const { orgA, orgB, userA } = await seedTwoOrgs();
    expect((await api("/api/albums", { user: userA, orgId: orgA.id })).status).toBe(200);
    // userA is not a member of org B — every org-scoped route must 403.
    expect((await api("/api/albums", { user: userA, orgId: orgB.id })).status).toBe(403);
    expect((await api("/api/photos", { user: userA, orgId: orgB.id })).status).toBe(403);
    expect((await api("/api/stats/dashboard", { user: userA, orgId: orgB.id })).status).toBe(403);
  });

  async function listIds(path: string, user: { authUserId: string }, orgId: number): Promise<number[]> {
    const data = (await (await api(path, { user, orgId })).json()) as Array<{ id: number }>;
    return data.map((x) => x.id);
  }

  it("lists only the caller's own org resources", async () => {
    const { orgA, userA, a } = await seedTwoOrgs();

    expect(await listIds("/api/albums", userA, orgA.id)).toEqual([a.album.id]);
    expect(await listIds("/api/collections", userA, orgA.id)).toEqual([a.collection.id]);
    expect(await listIds("/api/projects", userA, orgA.id)).toEqual([a.project.id]);
    expect(await listIds("/api/assets", userA, orgA.id)).toEqual([a.asset.id]);
    expect(await listIds("/api/attribution-tags", userA, orgA.id)).toEqual([a.attr.id]);

    const photos = (await (await api("/api/photos", { user: userA, orgId: orgA.id })).json()) as {
      photos: Array<{ id: number }>;
    };
    expect(photos.photos.map((x) => x.id)).toEqual([a.photo.id]);
  });

  it("returns 404 when fetching another org's entity by id", async () => {
    const { orgA, userA, b } = await seedTwoOrgs();
    const opts = { user: userA, orgId: orgA.id };
    expect((await api(`/api/albums/${b.album.id}`, opts)).status).toBe(404);
    expect((await api(`/api/photos/${b.photo.id}`, opts)).status).toBe(404);
    expect((await api(`/api/collections/${b.collection.id}`, opts)).status).toBe(404);
    expect((await api(`/api/projects/${b.project.id}`, opts)).status).toBe(404);
  });

  it("dashboard counts only the caller's org", async () => {
    const { orgA, userA } = await seedTwoOrgs();
    const stats = (await (await api("/api/stats/dashboard", { user: userA, orgId: orgA.id })).json()) as {
      totalAlbums: number;
      totalPhotos: number;
      totalCollections: number;
      totalProjects: number;
      totalUsers: number;
    };
    // Exactly the one album/photo/collection/project seeded for org A.
    expect(stats.totalAlbums).toBe(1);
    expect(stats.totalPhotos).toBe(1);
    expect(stats.totalCollections).toBe(1);
    expect(stats.totalProjects).toBe(1);
    expect(stats.totalUsers).toBe(1); // one member in org A
  });

  it("cannot mutate another org's entity", async () => {
    const { orgA, userA, b } = await seedTwoOrgs();
    const opts = { user: userA, orgId: orgA.id };
    // Rename B's album as A → 404 (not found in A's scope).
    expect((await api(`/api/albums/${b.album.id}`, { ...opts, method: "PATCH", body: { title: "hijacked" } })).status).toBe(404);
    // Delete B's photo as A → 404.
    expect((await api(`/api/photos/${b.photo.id}`, { ...opts, method: "DELETE" })).status).toBe(404);
    // Add B's photo to A's collection → 404 (photo not in A).
    expect((await api(`/api/collections/${b.collection.id}/photos`, { ...opts, method: "POST", body: { photoId: b.photo.id } })).status).toBe(404);
  });

  it("/organizations lists only memberships; switch to a non-member org 403s", async () => {
    const { orgA, orgB, userA } = await seedTwoOrgs();
    const orgs = (await (await api("/api/organizations", { user: userA })).json()) as Array<{ slug: string }>;
    expect(orgs.map((o) => o.slug)).toEqual(["org-a"]);
    expect((await api("/api/organizations/switch", { user: userA, method: "POST", body: { organizationId: orgB.id } })).status).toBe(403);
    expect((await api("/api/organizations/switch", { user: userA, method: "POST", body: { organizationId: orgA.id } })).status).toBe(200);
  });

  it("a user with no org can create one and is enrolled as owner (#113 Phase 4b)", async () => {
    const user = await createUser({ name: "New Signup" });

    // No membership → tenant routes 403 and the org list is empty.
    expect((await api("/api/albums", { user })).status).toBe(403);
    expect(await (await api("/api/organizations", { user })).json()).toEqual([]);

    // Create an org — becomes owner, slug derived from the name.
    const res = await api("/api/organizations", { user, method: "POST", body: { name: "Acme Photos" } });
    expect(res.status).toBe(201);
    const org = (await res.json()) as { id: number; name: string; slug: string; role: string };
    expect(org.name).toBe("Acme Photos");
    expect(org.slug).toBe("acme-photos");
    expect(org.role).toBe("owner");

    // Now a member → tenant routes work and the org list shows it.
    expect((await api("/api/albums", { user, orgId: org.id })).status).toBe(200);
    const orgs = (await (await api("/api/organizations", { user })).json()) as Array<{ id: number }>;
    expect(orgs.map((o) => o.id)).toEqual([org.id]);
  });

  it("requires authentication and org membership", async () => {
    const { orgA } = await seedTwoOrgs();
    // No auth header → 401.
    expect((await api("/api/albums", { orgId: orgA.id })).status).toBe(401);
  });

  it("storage ACL: org-prefixed object keys require membership (#113 Phase 3c)", async () => {
    const { orgA, orgB, userA } = await seedTwoOrgs();
    // Own org → allowed; other org → denied; legacy (unprefixed) key → allowed.
    expect(await mayAccessObjectPath(userA.id, `orgs/${orgA.id}/uploads/x`)).toBe(true);
    expect(await mayAccessObjectPath(userA.id, `orgs/${orgB.id}/uploads/x`)).toBe(false);
    expect(await mayAccessObjectPath(userA.id, "uploads/legacy-key")).toBe(true);
  });

  it("admin maintenance (hub-status) is org-admin-gated and per-org (#113 Phase 3d)", async () => {
    const { orgA, userA } = await seedTwoOrgs();
    const member = await createUser({ name: "Plain Member 2" });
    await addOrganizationMember(orgA.id, member.id, "member");

    // Owner gets a per-org status payload; a plain member is forbidden.
    const owner = await api("/api/admin/hub-status", { user: userA, orgId: orgA.id });
    expect(owner.status).toBe(200);
    const body = (await owner.json()) as { aiAnalysisPending: number; duplicateGroups: number };
    expect(typeof body.aiAnalysisPending).toBe("number");
    expect(typeof body.duplicateGroups).toBe("number");

    expect((await api("/api/admin/hub-status", { user: member, orgId: orgA.id })).status).toBe(403);
  });

  it("AI settings are per-org and gated to org owner/admin (#113 Phase 3)", async () => {
    const { orgA, orgB, userA, userB } = await seedTwoOrgs();
    const member = await createUser({ name: "Plain Member" });
    await addOrganizationMember(orgA.id, member.id, "member");

    // Owner can read (this also lazily creates org A's settings row).
    expect((await api("/api/admin/ai-settings", { user: userA, orgId: orgA.id })).status).toBe(200);
    // A plain member is forbidden by requireOrgRole("owner","admin").
    expect((await api("/api/admin/ai-settings", { user: member, orgId: orgA.id })).status).toBe(403);

    // Change org A's active provider; org B must be unaffected.
    const patch = await api("/api/admin/ai-settings", {
      user: userA, orgId: orgA.id, method: "PATCH", body: { activeProvider: "anthropic" },
    });
    expect(patch.status).toBe(200);

    const a = (await (await api("/api/admin/ai-settings", { user: userA, orgId: orgA.id })).json()) as { activeProvider: string };
    const b = (await (await api("/api/admin/ai-settings", { user: userB, orgId: orgB.id })).json()) as { activeProvider: string };
    expect(a.activeProvider).toBe("anthropic");
    expect(b.activeProvider).toBe("openai");
  });
});
