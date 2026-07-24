import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  db,
  photosTable,
  organizationsTable,
  usersTable,
  ratingsTable,
  organizationSubscriptionsTable,
  session,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Pro list price in cents — MRR is derived (proCount * this). Enterprise is
// custom/uncounted here. Keep in sync with the $19.99/mo shown in the UI.
const PRO_PRICE_CENTS = 1999;
const WINDOW_DAYS = 30;

type Point = { date: string; count: number };

// UTC YYYY-MM-DD strings for the last N days (oldest first), so the client gets
// a dense, gap-filled series regardless of which days had activity.
function lastNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

// Daily counts over the window, filled to a dense N-day series. `isTz` picks
// the right UTC-date expression: timestamptz columns convert to UTC first;
// the Better Auth `session.created_at` is a plain (UTC-stored) timestamp.
async function dailySeries(col: PgColumn, table: PgTable, isTz: boolean, dates: string[]): Promise<Point[]> {
  const dayExpr = isTz
    ? sql`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
    : sql`to_char(${col}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ d: sql<string>`${dayExpr}`, c: sql<number>`cast(count(*) as integer)` })
    .from(table)
    .where(sql`${col} >= now() - interval '${sql.raw(String(WINDOW_DAYS))} days'`)
    .groupBy(dayExpr);
  const byDay = new Map(rows.map((r) => [r.d, Number(r.c)]));
  return dates.map((date) => ({ date, count: byDay.get(date) ?? 0 }));
}

// Platform-wide analytics for the operator (#155). Platform-admin only — no
// org scoping here by design; this is the cross-org business view.
router.get("/superadmin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const dates = lastNDates(WINDOW_DAYS);
  const scalar = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);

  const [
    organizations,
    users,
    photos,
    storageBytes,
    activeUsers7d,
    activeUsers30d,
    planRows,
    canceledSubscriptions,
    signups,
    newOrgs,
    uploads,
    logins,
    ratings,
  ] = await Promise.all([
    scalar(db.select({ n: sql<number>`cast(count(*) as integer)` }).from(organizationsTable)),
    scalar(db.select({ n: sql<number>`cast(count(*) as integer)` }).from(usersTable)),
    scalar(db.select({ n: sql<number>`cast(count(*) as integer)` }).from(photosTable)),
    scalar(db.select({ n: sql<number>`cast(coalesce(sum(${photosTable.filesize}),0) as bigint)` }).from(photosTable)),
    scalar(
      db
        .select({ n: sql<number>`cast(count(distinct ${session.userId}) as integer)` })
        .from(session)
        .where(sql`${session.createdAt} >= now() - interval '7 days'`),
    ),
    scalar(
      db
        .select({ n: sql<number>`cast(count(distinct ${session.userId}) as integer)` })
        .from(session)
        .where(sql`${session.createdAt} >= now() - interval '30 days'`),
    ),
    db
      .select({ plan: organizationsTable.plan, n: sql<number>`cast(count(*) as integer)` })
      .from(organizationsTable)
      .groupBy(organizationsTable.plan) as Promise<{ plan: string; n: number }[]>,
    scalar(
      db
        .select({ n: sql<number>`cast(count(*) as integer)` })
        .from(organizationSubscriptionsTable)
        .where(sql`${organizationSubscriptionsTable.status} = 'canceled'`),
    ),
    dailySeries(usersTable.createdAt, usersTable, true, dates),
    dailySeries(organizationsTable.createdAt, organizationsTable, true, dates),
    dailySeries(photosTable.createdAt, photosTable, true, dates),
    dailySeries(session.createdAt, session, false, dates),
    dailySeries(ratingsTable.createdAt, ratingsTable, true, dates),
  ]);

  const planCounts = { free: 0, pro: 0, enterprise: 0 } as Record<string, number>;
  for (const r of planRows) planCounts[r.plan] = Number(r.n);

  res.json({
    windowDays: WINDOW_DAYS,
    totals: {
      organizations,
      users,
      photos,
      storageBytes: Number(storageBytes),
      activeUsers7d,
      activeUsers30d,
      mrrCents: (planCounts.pro ?? 0) * PRO_PRICE_CENTS,
      canceledSubscriptions,
      planCounts,
    },
    series: { signups, newOrgs, uploads, logins, ratings },
  });
});

export default router;
