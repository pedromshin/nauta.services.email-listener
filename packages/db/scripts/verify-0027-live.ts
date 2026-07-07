/**
 * Live-verification script for migration 0027 (Phase 30-02, Task 1).
 *
 * Direct pg query against the live DB (NOT a TS/Drizzle type check — types
 * come from the schema source, not the live DB) proving:
 *   (a) knowledge_node_edges.promotion exists with udt=jsonb, nullable=YES
 *   (b) knowledge_node_edges.provenance (Phase 29 synthesis provenance) is
 *       UNTOUCHED — still jsonb/nullable, proving the migration didn't
 *       collide with the existing column
 *
 * Usage: npm run with-env -- tsx scripts/verify-0027-live.ts
 * Exit codes: 0 = all assertions passed, 1 = any assertion failed
 */

import pg from "pg";

import { env } from "../src/client";

const { Client } = pg;

const verify = async (): Promise<void> => {
  if (!env.POSTGRES_URL_NON_POOLING) {
    console.error("POSTGRES_URL_NON_POOLING is not defined");
    process.exit(1);
  }

  const client = new Client({ connectionString: env.POSTGRES_URL_NON_POOLING });
  let failed = false;

  try {
    await client.connect();

    const colResult = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'knowledge_node_edges' AND column_name IN ('promotion', 'provenance')
       ORDER BY column_name`,
    );
    console.log("Columns:");
    for (const row of colResult.rows) {
      console.log(
        `  ${row.table_name}.${row.column_name}: type=${row.data_type} udt=${row.udt_name} nullable=${row.is_nullable} default=${row.column_default}`,
      );
    }

    const expected = [
      { column: "promotion", udt: "jsonb", nullable: "YES" },
      { column: "provenance", udt: "jsonb", nullable: "YES" },
    ];

    for (const exp of expected) {
      const found = colResult.rows.find((r) => r.column_name === exp.column);
      if (!found) {
        console.error(`ASSERTION FAILED: missing knowledge_node_edges.${exp.column}`);
        failed = true;
        continue;
      }
      if (found.udt_name !== exp.udt || found.is_nullable !== exp.nullable) {
        console.error(
          `ASSERTION FAILED: knowledge_node_edges.${exp.column} expected udt=${exp.udt} nullable=${exp.nullable}, got udt=${found.udt_name} nullable=${found.is_nullable}`,
        );
        failed = true;
      }
    }

    if (failed) {
      console.error("VERIFICATION FAILED");
      process.exit(1);
    }

    console.log("VERIFICATION PASSED: all assertions confirmed live.");
  } catch (error) {
    console.error("Database connection error during verification:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

verify().catch((err: unknown) => {
  console.error("Unhandled error in verify script:", err);
  process.exit(1);
});
