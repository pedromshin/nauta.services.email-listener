/**
 * TEMPORARY prod DB diagnostic (2026-07-21). Public, read-only: runs `select 1`
 * through the app's own Drizzle client and returns the exact connection error +
 * which hosts are configured (passwords masked). Lets us SEE the real runtime
 * error without auth/logs. DELETE once the prod-500 is resolved.
 */
import { sql } from "drizzle-orm";

import { db } from "@polytoken/db/client";

export const dynamic = "force-dynamic";

function hostOf(u?: string): string | null {
  if (!u) return null;
  const m = u.match(/@([^/:@]+):(\d+)/);
  return m ? `${m[1]}:${m[2]}` : "unparsed";
}

export async function GET() {
  const info = {
    onVercel: !!process.env.VERCEL,
    postgresUrlHost: hostOf(process.env.POSTGRES_URL),
    nonPoolingHost: hostOf(process.env.POSTGRES_URL_NON_POOLING),
  };
  try {
    const r = await db.execute(sql`select 1 as ok`);
    return Response.json({ ok: true, info, rows: r });
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; errno?: string };
    return Response.json(
      { ok: false, info, error: err?.message ?? String(e), code: err?.code ?? err?.errno },
      { status: 500 },
    );
  }
}
