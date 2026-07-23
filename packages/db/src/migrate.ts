import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { env } from "./client";

const { Pool } = pg;

const runMigrate = async (): Promise<void> => {
  if (!env.POSTGRES_URL_NON_POOLING) {
    throw new Error("POSTGRES_URL_NON_POOLING is not defined");
  }

  // Use the non-pooling URL for direct PostgreSQL connection
  const connectionString = env.POSTGRES_URL_NON_POOLING;
  console.log("Using non-pooling connection for migrations");

  // The 0032 tenancy backfill reads current_setting('app.backfill_user_id') to
  // anchor rows when auth.users is empty (a brand-new database). The drizzle
  // node-postgres migrator runs migrations on pool connections we don't
  // control, so a session `SET` on our own connection is invisible to them
  // (a session GUC is connection-scoped — verified). The connection-independent
  // mechanism is a DATABASE-level default (`ALTER DATABASE … SET`), which is
  // inherited only by connections opened AFTER it — so it must be applied
  // through a throwaway connection that is fully closed BEFORE the migration
  // pool is created. This path only runs when BACKFILL_USER_ID is set (a fresh
  // empty DB); existing staging/prod applied 0032 long ago, so a normal deploy
  // never enters it. (The prior single-connection assumption here was broken.)
  const backfillUserId = env.BACKFILL_USER_ID;
  const dbName = backfillUserId
    ? new URL(connectionString).pathname.replace(/^\//, "")
    : undefined;
  const dbIdent = dbName ? `"${dbName.replace(/"/g, '""')}"` : undefined;

  const setBackfillDefault = async (value: string | null): Promise<void> => {
    if (!dbIdent) return;
    const setupPool = new Pool({ connectionString });
    try {
      if (value === null) {
        await setupPool.query(
          `ALTER DATABASE ${dbIdent} RESET app.backfill_user_id`,
        );
      } else {
        await setupPool.query(
          `ALTER DATABASE ${dbIdent} SET app.backfill_user_id = '${value}'`,
        );
      }
    } finally {
      await setupPool.end();
    }
  };

  if (backfillUserId && dbIdent) {
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(backfillUserId)) {
      throw new Error(`BACKFILL_USER_ID must be a UUID, got: ${backfillUserId}`);
    }
    await setBackfillDefault(backfillUserId);
    console.log(
      `⚠️  BACKFILL_USER_ID override active (db-level): ${backfillUserId}`,
    );
  }

  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();

    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      console.log("✅ Extensions verified (vector, uuid-ossp, pg_trgm)");

      const db = drizzle(client);

      console.log("⏳ Running migrations...");
      const start = Date.now();

      await migrate(db, { migrationsFolder: "migrations" });

      const end = Date.now();

      // Verify tables were created
      const result = await client.query(
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'",
      );
      const tableCount =
        (result.rows[0] as { count: number } | undefined)?.count ?? 0;
      console.log(
        `✅ Migrations completed in ${end - start}ms (${tableCount} tables)`,
      );
    } finally {
      client.release();
    }
    // Always clear the DB-level override so it never lingers as a default on
    // the database after the one-time backfill.
    if (backfillUserId) {
      await setBackfillDefault(null).catch(() => undefined);
    }
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);

    if (error instanceof Error) {
      if (
        error.message.includes("does not exist") ||
        error.message.includes("permission denied")
      ) {
        console.error("Possible causes:");
        console.error("- Missing database schema or permissions");
        console.error("- Connection to wrong database or environment");
        console.error("- Invalid Postgres URL");
      }

      if (error.message.includes("already exists")) {
        console.error(
          "Table or function already exists - you may need to drop it first",
        );
      }
    }

    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

console.log("Starting migration process...");
runMigrate().catch((err: unknown) => {
  console.error("❌ Migration failed with an unhandled error");
  console.error(err);
  process.exit(1);
});
