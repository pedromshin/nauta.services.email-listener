/**
 * detail.test.ts — unit tests for the entities.byId pure aggregation helper.
 *
 * DB-free: aggregateEntityFields is an exported pure helper tested without a
 * DB connection (same testability precedent as aggregateEntitySummary).
 *
 * Test plan:
 *   Test 1: aggregateEntityFields — single occurrence, single value: not conflicting.
 *   Test 2: aggregateEntityFields — two occurrences, same value: not conflicting, count=2.
 *   Test 3: aggregateEntityFields — two occurrences, distinct values: conflicting=true,
 *           both values retained with provenance, no canonical chosen (D-19).
 *   Test 4: aggregateEntityFields — multiple fields, only one conflicts.
 *   Test 5: aggregateEntityFields — empty input returns empty array.
 *   Test 6: aggregateEntityFields — does not mutate input (immutability).
 */

import { describe, expect, it } from "vitest";

import { aggregateEntityFields, type FieldOccurrenceRow } from "./detail";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROW_A: FieldOccurrenceRow = {
  emailId: "00000000-0000-0000-0000-000000000010",
  emailSubject: "Invoice INV-001",
  receivedAt: new Date("2024-01-10T00:00:00Z"),
  fieldSlug: "po_number",
  fieldLabel: "PO Number",
  value: "PO-1234",
  extractionStatus: "confirmed",
};

const ROW_B: FieldOccurrenceRow = {
  emailId: "00000000-0000-0000-0000-000000000011",
  emailSubject: "Follow-up on PO",
  receivedAt: new Date("2024-01-15T00:00:00Z"),
  fieldSlug: "po_number",
  fieldLabel: "PO Number",
  value: "PO-1234",
  extractionStatus: "confirmed",
};

const ROW_C: FieldOccurrenceRow = {
  emailId: "00000000-0000-0000-0000-000000000012",
  emailSubject: "Re: Invoice",
  receivedAt: new Date("2024-01-20T00:00:00Z"),
  fieldSlug: "po_number",
  fieldLabel: "PO Number",
  // Different value — conflicts with ROW_A and ROW_B
  value: "PO-9999",
  extractionStatus: "candidate",
};

const ROW_INVOICE: FieldOccurrenceRow = {
  emailId: "00000000-0000-0000-0000-000000000010",
  emailSubject: "Invoice INV-001",
  receivedAt: new Date("2024-01-10T00:00:00Z"),
  fieldSlug: "invoice_number",
  fieldLabel: "Invoice Number",
  value: "INV-001",
  extractionStatus: "confirmed",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("aggregateEntityFields", () => {
  it("Test 1: single occurrence, single value — not conflicting", () => {
    const result = aggregateEntityFields([ROW_A]);

    expect(result).toHaveLength(1);
    const field = result[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("field not defined");

    expect(field.fieldSlug).toBe("po_number");
    expect(field.fieldLabel).toBe("PO Number");
    expect(field.conflicting).toBe(false);
    expect(field.values).toHaveLength(1);
    expect(field.values[0]?.value).toBe("PO-1234");
    expect(field.values[0]?.emailId).toBe(ROW_A.emailId);
    expect(field.values[0]?.emailSubject).toBe(ROW_A.emailSubject);
    expect(field.values[0]?.extractionStatus).toBe("confirmed");
  });

  it("Test 2: two occurrences with the same value — not conflicting, two provenance entries", () => {
    const result = aggregateEntityFields([ROW_A, ROW_B]);

    expect(result).toHaveLength(1);
    const field = result[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("field not defined");

    expect(field.conflicting).toBe(false);
    // Both occurrences listed
    expect(field.values).toHaveLength(2);
  });

  it("Test 3: two distinct values — conflicting=true, BOTH values retained, no canonical (D-19)", () => {
    const result = aggregateEntityFields([ROW_A, ROW_C]);

    expect(result).toHaveLength(1);
    const field = result[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("field not defined");

    expect(field.conflicting).toBe(true);

    // Both distinct values must be present
    const values = field.values.map((v) => v.value);
    expect(values).toContain("PO-1234");
    expect(values).toContain("PO-9999");

    // Provenance for conflicting value PO-9999
    const conflictEntry = field.values.find((v) => v.value === "PO-9999");
    expect(conflictEntry?.emailId).toBe(ROW_C.emailId);
    expect(conflictEntry?.emailSubject).toBe("Re: Invoice");
    expect(conflictEntry?.extractionStatus).toBe("candidate");

    // No canonicalValue property set (D-19 — human decides)
    expect("canonicalValue" in field).toBe(false);
  });

  it("Test 4: multiple fields, only po_number conflicts", () => {
    const result = aggregateEntityFields([ROW_A, ROW_C, ROW_INVOICE]);

    // Two fields: po_number and invoice_number
    expect(result).toHaveLength(2);

    const poField = result.find((f) => f.fieldSlug === "po_number");
    const invoiceField = result.find((f) => f.fieldSlug === "invoice_number");

    expect(poField?.conflicting).toBe(true);
    expect(invoiceField?.conflicting).toBe(false);
  });

  it("Test 5: empty input returns empty array", () => {
    const result = aggregateEntityFields([]);
    expect(result).toEqual([]);
  });

  it("Test 6: does not mutate the input rows (immutability)", () => {
    const rows: FieldOccurrenceRow[] = [{ ...ROW_A }];
    const snapshot = JSON.stringify(rows);
    aggregateEntityFields(rows);
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});
