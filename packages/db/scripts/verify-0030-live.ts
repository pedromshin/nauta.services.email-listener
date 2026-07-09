/**
 * Live-verification script for migration 0030 (Phase 40-01, Task 1).
 *
 * Direct pg query against the live DB (NOT a TS/Drizzle type check — types
 * come from the schema source, not the live DB) proving:
 *   `chat_widget_interactions_widget_kind_check`'s constraint definition
 *   contains all three widget_kind values: 'proposal_cards', 'clarify_widget',
 *   'confirm_action'.
 *
 * Usage: npm run with-env -- tsx scripts/verify-0030-live.ts
 * Exit codes: 0 = all assertions passed, 1 = any assertion failed
 */

import pg from "pg";

import { env } from "../src/client";

const { Client } = pg;

const CONSTRAINT_NAME = "chat_widget_interactions_widget_kind_check";
const EXPECTED_VALUES = ["proposal_cards", "clarify_widget", "confirm_action"];

const verify = async (): Promise<void> => {
  if (!env.POSTGRES_URL_NON_POOLING) {
    console.error("POSTGRES_URL_NON_POOLING is not defined");
    process.exit(1);
  }

  const client = new Client({ connectionString: env.POSTGRES_URL_NON_POOLING });
  let failed = false;

  try {
    await client.connect();

    const result = await client.query<{ check_clause: string }>(
      `SELECT cc.check_clause
       FROM information_schema.check_constraints cc
       WHERE cc.constraint_name = $1`,
      [CONSTRAINT_NAME],
    );

    const row = result.rows[0];
    if (!row) {
      console.error(`ASSERTION FAILED: constraint ${CONSTRAINT_NAME} not found`);
      process.exit(1);
    }

    console.log(`Constraint definition: ${row.check_clause}`);

    for (const value of EXPECTED_VALUES) {
      if (!row.check_clause.includes(value)) {
        console.error(
          `ASSERTION FAILED: constraint definition missing expected value '${value}'`,
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
