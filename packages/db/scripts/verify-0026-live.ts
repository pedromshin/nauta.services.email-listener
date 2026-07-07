/**
 * Live-verification script for migration 0026 (Phase 29-01, Task 3).
 *
 * Direct pg query against the live DB (NOT a TS/Drizzle type check — types
 * come from the schema source, not the live DB) proving:
 *   (a) knowledge_trust_tier enum has exactly EXTRACTED, INFERRED, AMBIGUOUS
 *       in ordinal order
 *   (b) knowledge_nodes.tier and knowledge_node_edges.tier/provenance/
 *       is_active exist with the expected data types / nullability / default
 *
 * Usage: npm run with-env -- tsx scripts/verify-0026-live.ts
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

    // (a) enum labels, ordinal order
    const enumResult = await client.query<{ labels: string }>(
      `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) AS labels
       FROM pg_enum
       JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
       WHERE typname = 'knowledge_trust_tier'`,
    );
    const labels = enumResult.rows[0]?.labels ?? null;
    console.log(`knowledge_trust_tier enum labels: ${labels}`);
    if (labels !== "EXTRACTED,INFERRED,AMBIGUOUS") {
      console.error("ASSERTION FAILED: enum labels not EXTRACTED,INFERRED,AMBIGUOUS");
      failed = true;
    }

    // (b) columns
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
       WHERE (table_name = 'knowledge_nodes' AND column_name = 'tier')
          OR (table_name = 'knowledge_node_edges' AND column_name IN ('tier', 'provenance', 'is_active'))
       ORDER BY table_name, column_name`,
    );
    console.log("Columns:");
    for (const row of colResult.rows) {
      console.log(
        `  ${row.table_name}.${row.column_name}: type=${row.data_type} udt=${row.udt_name} nullable=${row.is_nullable} default=${row.column_default}`,
      );
    }

    const expected = [
      { table: "knowledge_nodes", column: "tier", udt: "knowledge_trust_tier", nullable: "NO" },
      { table: "knowledge_node_edges", column: "tier", udt: "knowledge_trust_tier", nullable: "NO" },
      { table: "knowledge_node_edges", column: "provenance", udt: "jsonb", nullable: "YES" },
      { table: "knowledge_node_edges", column: "is_active", udt: "bool", nullable: "NO" },
    ];

    for (const exp of expected) {
      const found = colResult.rows.find(
        (r) => r.table_name === exp.table && r.column_name === exp.column,
      );
      if (!found) {
        console.error(`ASSERTION FAILED: missing ${exp.table}.${exp.column}`);
        failed = true;
        continue;
      }
      if (found.udt_name !== exp.udt || found.is_nullable !== exp.nullable) {
        console.error(
          `ASSERTION FAILED: ${exp.table}.${exp.column} expected udt=${exp.udt} nullable=${exp.nullable}, got udt=${found.udt_name} nullable=${found.is_nullable}`,
        );
        failed = true;
      }
    }

    // Index check
    const idxResult = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'knowledge_node_edges' AND indexname = 'idx_knowledge_node_edges_active_identity'`,
    );
    console.log(`Partial index present: ${idxResult.rows.length > 0}`);
    if (idxResult.rows.length === 0) {
      console.error("ASSERTION FAILED: idx_knowledge_node_edges_active_identity missing");
      failed = true;
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
