import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run a pgvector nearest-neighbour query with iterative HNSW scanning.
 *
 * By default pgvector's HNSW scan returns at most `hnsw.ef_search` (40)
 * candidates; WHERE filters (hidden photos, excluded members) then shrink
 * that further, so a `LIMIT 100` ranking silently came back with ~37 rows no
 * matter how many photos matched. Iterative scanning (pgvector >= 0.8) keeps
 * pulling from the index until the LIMIT is actually satisfied, and
 * `strict_order` preserves exact distance order — which offset paging relies
 * on to stitch consecutive pages without gaps or duplicates.
 */
export function withIterativeVectorScan<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = strict_order`);
    return run(tx);
  });
}
