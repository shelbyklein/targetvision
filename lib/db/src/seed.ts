import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import {
  usersTable,
  albumsTable,
  photosTable,
  tagsTable,
  photoTagsTable,
  categoriesTable,
  photoCategoriesTable,
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

  const categories = [
    { name: "Team Event" },
    { name: "Offsite" },
    { name: "Celebration" },
    { name: "Day-to-Day" },
    { name: "Product Launch" },
  ];

  const tags = [
    { name: "funny" },
    { name: "candid" },
    { name: "group" },
    { name: "portrait" },
    { name: "outdoor" },
    { name: "indoor" },
    { name: "food" },
    { name: "milestone" },
  ];

  const insertedCategories = await db
    .insert(categoriesTable)
    .values(categories)
    .onConflictDoNothing()
    .returning();

  const insertedTags = await db
    .insert(tagsTable)
    .values(tags)
    .onConflictDoNothing()
    .returning();

  console.log(`  ${insertedCategories.length} categories seeded`);
  console.log(`  ${insertedTags.length} tags seeded`);

  const [seedUser] = await db
    .insert(usersTable)
    .values({
      clerkId: "seed_demo_user",
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
      clerkId: "seed_demo_user_2",
      name: "Jordan Kim",
      email: "jordan@targetvision.demo",
      role: "member",
    })
    .onConflictDoNothing()
    .returning();

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

  const albums = await db.insert(albumsTable).values(albumData).returning();
  console.log(`  ${albums.length} albums seeded`);

  const photoData = [
    {
      albumId: albums[0].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800",
      caption: "Opening remarks from the CEO",
      takenAt: new Date("2024-01-15T09:00:00Z"),
    },
    {
      albumId: albums[0].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800",
      caption: "Team dinner — everyone's hungry!",
      takenAt: new Date("2024-01-15T19:30:00Z"),
    },
    {
      albumId: albums[0].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800",
      caption: "Q1 planning session in full swing",
      takenAt: new Date("2024-01-15T14:00:00Z"),
    },
    {
      albumId: albums[1].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
      caption: "Morning hike with a stunning view",
      takenAt: new Date("2024-07-21T07:30:00Z"),
    },
    {
      albumId: albums[1].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      caption: "Strategy session overlooking the lake",
      takenAt: new Date("2024-07-20T15:00:00Z"),
    },
    {
      albumId: albums[1].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800",
      caption: "Barbecue night — chef mode activated",
      takenAt: new Date("2024-07-20T20:00:00Z"),
    },
    {
      albumId: albums[2].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
      caption: "Launch countdown — all eyes on the screen",
      takenAt: new Date("2024-09-05T18:00:00Z"),
    },
    {
      albumId: albums[2].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
      caption: "Celebration toast — we shipped it!",
      takenAt: new Date("2024-09-05T20:30:00Z"),
    },
    {
      albumId: albums[3].id,
      uploaderId: secondUser!.id,
      url: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800",
      caption: "Holiday party at the rooftop venue",
      takenAt: new Date("2024-12-14T19:00:00Z"),
    },
    {
      albumId: albums[3].id,
      uploaderId: seedUser.id,
      url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800",
      caption: "Team group photo — end of an amazing year",
      takenAt: new Date("2024-12-14T22:00:00Z"),
    },
  ];

  const photos = await db.insert(photosTable).values(photoData).returning();
  console.log(`  ${photos.length} photos seeded`);

  const tagMap = Object.fromEntries(insertedTags.map((t) => [t.name, t.id]));
  const catMap = Object.fromEntries(insertedCategories.map((c) => [c.name, c.id]));

  const photoTagData = [
    { photoId: photos[0].id, tagId: tagMap["indoor"] },
    { photoId: photos[0].id, tagId: tagMap["group"] },
    { photoId: photos[1].id, tagId: tagMap["food"] },
    { photoId: photos[1].id, tagId: tagMap["candid"] },
    { photoId: photos[2].id, tagId: tagMap["group"] },
    { photoId: photos[2].id, tagId: tagMap["indoor"] },
    { photoId: photos[3].id, tagId: tagMap["outdoor"] },
    { photoId: photos[3].id, tagId: tagMap["candid"] },
    { photoId: photos[4].id, tagId: tagMap["outdoor"] },
    { photoId: photos[4].id, tagId: tagMap["group"] },
    { photoId: photos[5].id, tagId: tagMap["food"] },
    { photoId: photos[5].id, tagId: tagMap["outdoor"] },
    { photoId: photos[6].id, tagId: tagMap["milestone"] },
    { photoId: photos[6].id, tagId: tagMap["indoor"] },
    { photoId: photos[7].id, tagId: tagMap["milestone"] },
    { photoId: photos[7].id, tagId: tagMap["candid"] },
    { photoId: photos[8].id, tagId: tagMap["group"] },
    { photoId: photos[8].id, tagId: tagMap["indoor"] },
    { photoId: photos[9].id, tagId: tagMap["group"] },
    { photoId: photos[9].id, tagId: tagMap["milestone"] },
  ].filter((r) => r.tagId !== undefined);

  if (photoTagData.length) {
    await db.insert(photoTagsTable).values(photoTagData as { photoId: number; tagId: number }[]).onConflictDoNothing();
  }

  const photoCatData = [
    { photoId: photos[0].id, categoryId: catMap["Team Event"] },
    { photoId: photos[1].id, categoryId: catMap["Team Event"] },
    { photoId: photos[2].id, categoryId: catMap["Team Event"] },
    { photoId: photos[3].id, categoryId: catMap["Offsite"] },
    { photoId: photos[4].id, categoryId: catMap["Offsite"] },
    { photoId: photos[5].id, categoryId: catMap["Offsite"] },
    { photoId: photos[6].id, categoryId: catMap["Product Launch"] },
    { photoId: photos[7].id, categoryId: catMap["Celebration"] },
    { photoId: photos[8].id, categoryId: catMap["Celebration"] },
    { photoId: photos[9].id, categoryId: catMap["Team Event"] },
  ].filter((r) => r.categoryId !== undefined);

  if (photoCatData.length) {
    await db.insert(photoCategoriesTable).values(photoCatData as { photoId: number; categoryId: number }[]).onConflictDoNothing();
  }

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
