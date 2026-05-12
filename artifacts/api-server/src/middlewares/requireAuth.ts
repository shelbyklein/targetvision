import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, insertUserSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      dbUser?: typeof usersTable.$inferSelect;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;

  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  if (!user) {
    const name = (auth as any)?.sessionClaims?.name ?? (auth as any)?.sessionClaims?.email ?? "Unknown";
    const email = (auth as any)?.sessionClaims?.email ?? `${clerkId}@unknown.com`;
    const parsed = insertUserSchema.safeParse({ clerkId, name, email, role: "member" });
    if (!parsed.success) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }
    [user] = await db.insert(usersTable).values(parsed.data).returning();
  }

  req.dbUser = user;
  next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  await requireAuth(req, res, () => {
    if (!req.dbUser) return;
    if (req.dbUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin only" });
      return;
    }
    next();
  });
};
