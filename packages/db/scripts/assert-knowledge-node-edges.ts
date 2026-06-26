/**
 * Gate script: assert that knowledge_node_edges table exists in the live DB.
 *
 * Queries information_schema.tables (not the Drizzle schema source) so this
 * is a true live-DB assertion, not a false-green from local schema state.
 *
 * Usage (requires POSTGRES_URL_NON_POOLING in environment):
 *   npm run with-env -- tsx scripts/assert-knowledge-node-edges.ts
 *
 * Exit codes:
 *   0 — table exists
 *   1 — table missing or connection error
 */

import pg from "pg";

import { env } from "../src/client";

const { Client } = pg;

const TABLE_NAME = "knowledge_node_edges";
const SCHEMA_NAME = "public";

const assert = async (): Promise<void> => {
  if (!env.POSTGRES_URL_NON_POOLING) {
    console.error("POSTGRES_URL_NON_POOLING is not defined");
    process.exit(1);
  }

  const client = new Client({ connectionString: env.POSTGRES_URL_NON_POOLING });

  try {
    await client.connect();

    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = $1
           AND table_name   = $2
       ) AS "exists"`,
      [SCHEMA_NAME, TABLE_NAME],
    );

    const exists = result.rows[0]?.exists ?? false;

    if (!exists) {
      console.error(
        `ASSERTION FAILED: table "${SCHEMA_NAME}.${TABLE_NAME}" does not exist in the live DB.`,
      );
      console.error(
        "Run 'npm run migrate:local' (or migrate:staging / migrate:prod) first.",
      );
      process.exit(1);
    }

    console.log(
      `ASSERTION PASSED: "${SCHEMA_NAME}.${TABLE_NAME}" exists in the live DB.`,
    );
  } catch (error) {
    console.error("Database connection error during assertion:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

assert().catch((err: unknown) => {
  console.error("Unhandled error in assert script:", err);
  process.exit(1);
});
