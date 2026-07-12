/**
 * _column-detect.ts — the single feature-detection point for "has this
 * migration landed yet?" questions (T-54-01-05).
 *
 * Phase 54 (CLUS-02) introduces migration 0036 (chat_conversations.thread_id)
 * AUTHORED but APPLIED TO NO ENVIRONMENT tonight (Docker/WSL down — the
 * morning §H flow applies it local -> staging -> prod). Every reader/writer
 * of a column that might not exist yet MUST gate through `tableColumnExists`
 * first, so an unapplied migration degrades to a clean "unavailable" result
 * instead of a raw Postgres UndefinedColumn (42703) surfacing as a 500. This
 * plan is the first consumer (chat/thread-link.ts); later plans reuse it
 * verbatim rather than re-implementing detection per call site.
 *
 * Cached per-process (module-level Map): a server process only needs to
 * learn "this column doesn't exist yet" once. A process restart — which
 * happens on every deploy, including the morning migration-apply flow —
 * re-checks fresh, so a migration applied after this process started is
 * picked up on the NEXT restart, never mid-process (acceptable: this is a
 * feature-detection gate for a same-night migration rollout, not a live
 * schema-watcher).
 */

import { sql } from "drizzle-orm";

import type { OwnershipDb } from "@polytoken/db/ownership";

const columnExistsCache = new Map<string, boolean>();

function cacheKey(table: string, column: string): string {
  return `${table}.${column}`;
}

/**
 * tableColumnExists — true when `table.column` exists in the `public`
 * schema right now. Parameterized (no string interpolation into the SQL
 * text — `table`/`column` are bound query parameters via drizzle's `sql`
 * tag, not spliced in). Any error from the underlying query (missing table,
 * connectivity, permissions, or the column genuinely not existing) is
 * treated the same as "not present" — fail-closed to "unavailable", never
 * throws, so a caller that merely wanted to know whether a column exists
 * yet never crashes because of this check itself.
 */
export async function tableColumnExists(
  db: OwnershipDb,
  table: string,
  column: string,
): Promise<boolean> {
  const key = cacheKey(table, column);
  const cached = columnExistsCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let exists = false;
  try {
    const rows = await db.execute(
      sql`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column} LIMIT 1`,
    );
    exists = rows.length > 0;
  } catch {
    exists = false;
  }

  columnExistsCache.set(key, exists);
  return exists;
}

/**
 * __resetColumnExistsCacheForTests — test-only escape hatch so vitest suites
 * exercising both "column exists" and "column absent" branches within the
 * same process don't leak cache state across cases. NEVER called from
 * production code (T-54-01-05's cache is intentionally process-lifetime).
 */
export function __resetColumnExistsCacheForTests(): void {
  columnExistsCache.clear();
}
