import { type Request, type Response, type NextFunction } from "express";
import { getAuth, type SignedInAuthObject } from "@clerk/express";
import { db, usersTable, insertUserSchema } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      dbUser?: typeof usersTable.$inferSelect;
    }
  }
}

function claimString(auth: SignedInAuthObject, key: string): string | undefined {
  const claims = auth.sessionClaims;
  if (claims && typeof claims === "object" && key in claims) {
    const val = (claims as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return undefined;
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
    const name = claimString(auth, "name") ?? claimString(auth, "email") ?? "Unknown";
    const email = claimString(auth, "email") ?? `${clerkId}@unknown.com`;
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
