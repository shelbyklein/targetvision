import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import {
  usersTable,
  organizationsTable,
  organizationMembersTable,
  albumsTable,
  photosTable,
  ratingsTable,
} from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log("Seeding database…");

  const [seedUser] = await db
    .insert(usersTable)
    .values({
      // Seed users have no Better Auth account rows, so they can't sign in —
      // they exist only to attach demo albums/photos to.
      authUserId: "seed_demo_user",
      name: "Alex Rivera",
      email: "alex@targetvision.demo",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();

  if (!seedUser) {
    console.log("  Demo user already exists — skipping photo/album seed");
    await pool.end();
    return;
  }

  const [secondUser] = await db
    .insert(usersTable)
    .values({
      authUserId: "seed_demo_user_2",
      name: "Jordan Kim",
      email: "jordan@targetvision.demo",
      role: "member",
    })
    .onConflictDoNothing()
    .returning();

  // All demo data lives in one organization (issue #113); both seed users are
  // members (the admin owns it).
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: "Demo Org", slug: "demo-org" })
    .onConflictDoNothing()
    .returning();
  await db
    .insert(organizationMembersTable)
    .values([
      { organizationId: org.id, userId: seedUser.id, role: "owner" },
      { organizationId: org.id, userId: secondUser!.id, role: "member" },
    ])
    .onConflictDoNothing();

  const albumData = [
    {
      ownerId: seedUser.id,
      title: "Q1 Kickoff 2024",
      description: "All-hands kickoff meeting and team dinner.",
      eventDate: "2024-01-15",
    },
    {
      ownerId: seedUser.id,
      title: "Summer Offsite — Lake Tahoe",
      description: "Two days of strategy sessions, hiking, and barbecues.",
      eventDate: "2024-07-20",
    },
    {
      ownerId: secondUser!.id,
      title: "Product Launch: Horizon v2",
      description: "Celebration night for shipping Horizon v2.",
      eventDate: "2024-09-05",
    },
    {
      ownerId: secondUser!.id,
      title: "Holiday Party 2024",
      description: "Year-end party at the rooftop venue.",
      eventDate: "2024-12-14",
    },
  ];

  const albums = await db
    .insert(albumsTable)
    .values(albumData.map((a) => ({ ...a, organizationId: org.id })))
    .returning();
  console.log(`  ${albums.length} albums seeded`);

  const photoData = [
    {
      albumId: albums[0].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800",
      takenAt: new Date("2024-01-15T09:00:00Z"),
    },
    {
      albumId: albums[0].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800",
      takenAt: new Date("2024-01-15T19:30:00Z"),
    },
    {
      albumId: albums[0].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800",
      takenAt: new Date("2024-01-15T14:00:00Z"),
    },
    {
      albumId: albums[1].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
      takenAt: new Date("2024-07-21T07:30:00Z"),
    },
    {
      albumId: albums[1].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      takenAt: new Date("2024-07-20T15:00:00Z"),
    },
    {
      albumId: albums[1].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800",
      takenAt: new Date("2024-07-20T20:00:00Z"),
    },
    {
      albumId: albums[2].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      takenAt: new Date("2024-09-05T18:00:00Z"),
    },
    {
      albumId: albums[2].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
      takenAt: new Date("2024-09-05T20:30:00Z"),
    },
    {
      albumId: albums[3].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800",
      takenAt: new Date("2024-12-14T19:00:00Z"),
    },
    {
      albumId: albums[3].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800",
      takenAt: new Date("2024-12-14T22:00:00Z"),
    },
  ];

  const photos = await db
    .insert(photosTable)
    .values(photoData.map((p) => ({ ...p, organizationId: org.id })))
    .returning();
  console.log(`  ${photos.length} photos seeded`);

  const ratingData = [
    { photoId: photos[0].id, userId: seedUser.id, score: 4 },
    { photoId: photos[1].id, userId: seedUser.id, score: 5 },
    { photoId: photos[2].id, userId: secondUser!.id, score: 4 },
    { photoId: photos[3].id, userId: seedUser.id, score: 5 },
    { photoId: photos[3].id, userId: secondUser!.id, score: 5 },
    { photoId: photos[4].id, userId: secondUser!.id, score: 4 },
    { photoId: photos[5].id, userId: seedUser.id, score: 3 },
    { photoId: photos[6].id, userId: secondUser!.id, score: 5 },
    { photoId: photos[7].id, userId: seedUser.id, score: 5 },
    { photoId: photos[7].id, userId: secondUser!.id, score: 5 },
    { photoId: photos[8].id, userId: seedUser.id, score: 4 },
    { photoId: photos[9].id, userId: secondUser!.id, score: 5 },
    { photoId: photos[9].id, userId: seedUser.id, score: 4 },
  ];

  await db.insert(ratingsTable).values(ratingData).onConflictDoNothing();

  await db
    .update(albumsTable)
    .set({ coverPhotoId: photos[0].id })
    .where(eq(albumsTable.id, albums[0].id));
  await db
    .update(albumsTable)
    .set({ coverPhotoId: photos[3].id })
    .where(eq(albumsTable.id, albums[1].id));
  await db
    .update(albumsTable)
    .set({ coverPhotoId: photos[6].id })
    .where(eq(albumsTable.id, albums[2].id));
  await db
    .update(albumsTable)
    .set({ coverPhotoId: photos[8].id })
    .where(eq(albumsTable.id, albums[3].id));

  console.log("  Ratings and cover photos set");
  console.log("Done! Database seeded successfully.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
