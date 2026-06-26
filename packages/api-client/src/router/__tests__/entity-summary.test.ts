/**
 * entity-summary.test.ts — unit tests for the pure aggregateEntitySummary
 * helper (09-04, D-23). DB-free: the helper transforms flat entity-component
 * rows into a per-email rollup, same testability pattern as groupEntityTypeRows.
 *
 * Test plan:
 *   Test 1: multiple entity components of the same type collapse into one
 *           { entityTypeId, label, count }.
 *   Test 2: an email with no entity rows yields an empty entities array.
 *   Test 3: distinct types within one email are preserved (first-appearance order).
 *   Test 4: rows with null entityTypeId / null label are skipped.
 *   Test 5: output preserves the requested email-id order and is immutable.
 *   Test 6: does not mutate the input rows (immutability).
 *   Test 7 (D-24): entityInstanceId from row surfaces on the aggregated entry.
 *   Test 8 (D-24): entityInstanceId is undefined when no selected link row provides one.
 */

import { describe, expect, it } from "vitest";

import {
  aggregateEntitySummary,
  type EntitySummaryRow,
} from "../emails/entity-summary";

const EMAIL_A = "00000000-0000-0000-0000-00000000000a";
const EMAIL_B = "00000000-0000-0000-0000-00000000000b";
const EMAIL_C = "00000000-0000-0000-0000-00000000000c";

const TYPE_BOL = "00000000-0000-0000-0000-0000000000b1";
const TYPE_INV = "00000000-0000-0000-0000-0000000000b2";

const INSTANCE_1 = "00000000-0000-0000-0000-000000000001";

describe("aggregateEntitySummary", () => {
  it("Test 1: collapses repeated entity types into one { label, count }", () => {
    const rows: EntitySummaryRow[] = [
      { emailId: EMAIL_A, entityTypeId: TYPE_BOL, label: "Bill of Lading" },
      { emailId: EMAIL_A, entityTypeId: TYPE_BOL, label: "Bill of Lading" },
      { emailId: EMAIL_A, entityTypeId: TYPE_BOL, label: "Bill of Lading" },
    ];

    const result = aggregateEntitySummary(rows, [EMAIL_A]);

    expect(result).toHaveLength(1);
    expect(result[0]!.emailId).toBe(EMAIL_A);
    expect(result[0]!.entities).toEqual([
      { entityTypeId: TYPE_BOL, label: "Bill of Lading", count: 3, entityInstanceId: undefined },
    ]);
  });

  it("Test 2: an email with no entity rows yields an empty entities array", () => {
    const result = aggregateEntitySummary([], [EMAIL_A]);

    expect(result).toEqual([{ emailId: EMAIL_A, entities: [] }]);
  });

  it("Test 3: distinct types in one email are preserved in first-appearance order", () => {
    const rows: EntitySummaryRow[] = [
      { emailId: EMAIL_A, entityTypeId: TYPE_INV, label: "Invoice" },
      { emailId: EMAIL_A, entityTypeId: TYPE_BOL, label: "Bill of Lading" },
      { emailId: EMAIL_A, entityTypeId: TYPE_INV, label: "Invoice" },
    ];

    const result = aggregateEntitySummary(rows, [EMAIL_A]);

    expect(result[0]!.entities).toEqual([
      { entityTypeId: TYPE_INV, label: "Invoice", count: 2, entityInstanceId: undefined },
      { entityTypeId: TYPE_BOL, label: "Bill of Lading", count: 1, entityInstanceId: undefined },
    ]);
  });

  it("Test 4: rows with null entityTypeId or null label are skipped", () => {
    const rows: EntitySummaryRow[] = [
      { emailId: EMAIL_A, entityTypeId: null, label: "Bill of Lading" },
      { emailId: EMAIL_A, entityTypeId: TYPE_BOL, label: null },
      { emailId: EMAIL_A, entityTypeId: TYPE_INV, label: "Invoice" },
    ];

    const result = aggregateEntitySummary(rows, [EMAIL_A]);

    expect(result[0]!.entities).toEqual([
      { entityTypeId: TYPE_INV, label: "Invoice", count: 1, entityInstanceId: undefined },
    ]);
  });

  it("Test 5: preserves requested email-id order, one entry per id", () => {
    const rows: EntitySummaryRow[] = [
      { emailId: EMAIL_C, entityTypeId: TYPE_BOL, label: "Bill of Lading" },
      { emailId: EMAIL_A, entityTypeId: TYPE_INV, label: "Invoice" },
    ];

    // Request order: A, B, C — B has no rows; result must still list all three
    // in the requested order so the caller can zip it onto its visible page.
    const result = aggregateEntitySummary(rows, [EMAIL_A, EMAIL_B, EMAIL_C]);

    expect(result.map((r) => r.emailId)).toEqual([EMAIL_A, EMAIL_B, EMAIL_C]);
    expect(result[0]!.entities).toHaveLength(1);
    expect(result[1]!.entities).toHaveLength(0);
    expect(result[2]!.entities).toHaveLength(1);
  });

  it("Test 6: does not mutate the input rows (immutability)", () => {
    const rows: EntitySummaryRow[] = [
      { emailId: EMAIL_A, entityTypeId: TYPE_BOL, label: "Bill of Lading" },
    ];
    const snapshot = JSON.stringify(rows);

    aggregateEntitySummary(rows, [EMAIL_A]);

    expect(JSON.stringify(rows)).toBe(snapshot);
  });

  it("Test 7 (D-24): entityInstanceId from row surfaces on the aggregated entry", () => {
    const rows: EntitySummaryRow[] = [
      {
        emailId: EMAIL_A,
        entityTypeId: TYPE_BOL,
        label: "Bill of Lading",
        entityInstanceId: INSTANCE_1,
      },
      {
        emailId: EMAIL_A,
        entityTypeId: TYPE_BOL,
        label: "Bill of Lading",
        entityInstanceId: INSTANCE_1,
      },
    ];

    const result = aggregateEntitySummary(rows, [EMAIL_A]);

    expect(result[0]!.entities[0]!.entityInstanceId).toBe(INSTANCE_1);
  });

  it("Test 8 (D-24): entityInstanceId is undefined when no row provides one", () => {
    const rows: EntitySummaryRow[] = [
      { emailId: EMAIL_A, entityTypeId: TYPE_INV, label: "Invoice" },
    ];

    const result = aggregateEntitySummary(rows, [EMAIL_A]);

    expect(result[0]!.entities[0]!.entityInstanceId).toBeUndefined();
  });
});
