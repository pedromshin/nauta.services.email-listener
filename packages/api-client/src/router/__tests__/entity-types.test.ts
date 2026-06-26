/**
 * entity-types.test.ts — unit tests for the groupEntityTypeRows pure helper.
 *
 * These tests use in-memory row fixtures — no DB mock needed since the helper
 * is a pure function that transforms flat join rows into nested entity type
 * objects.
 *
 * Test plan:
 *   Test 1: Collapses multiple rows with same slug into one object with sorted fields.
 *   Test 2: Entity type with no fields (null fieldKey) yields fields: [].
 *   Test 3: Returns new array/field objects (immutability check à la geometry.test.ts).
 *   Test 4: dataType maps from fieldType; isRequired passes through unchanged.
 */

import { describe, expect, it } from "vitest";

import { groupEntityTypeRows } from "../entity-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROW_BILL_FIELD_1 = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "bill_of_lading",
  label: "Bill of Lading",
  description: "Shipping document",
  isActive: true,
  fieldId: "aaaaaaaa-1111-1111-1111-111111111111",
  fieldKey: "shipper_name",
  fieldLabel: "Shipper Name",
  fieldDataType: "string",
  fieldIsRequired: true,
  fieldSortOrder: 1,
  fieldIsIdentifier: false,
} as const;

const ROW_BILL_FIELD_2 = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "bill_of_lading",
  label: "Bill of Lading",
  description: "Shipping document",
  isActive: true,
  fieldId: "aaaaaaaa-2222-2222-2222-222222222222",
  fieldKey: "consignee_name",
  fieldLabel: "Consignee Name",
  fieldDataType: "string",
  fieldIsRequired: false,
  fieldSortOrder: 2,
  fieldIsIdentifier: true,
} as const;

const ROW_NO_FIELDS = {
  id: "22222222-2222-2222-2222-222222222222",
  slug: "unknown_type",
  label: "Unknown Type",
  description: null,
  isActive: false,
  fieldId: null,
  fieldKey: null,
  fieldLabel: null,
  fieldDataType: null,
  fieldIsRequired: null,
  fieldSortOrder: null,
  fieldIsIdentifier: null,
} as const;

const ROW_INVOICE = {
  id: "33333333-3333-3333-3333-333333333333",
  slug: "commercial_invoice",
  label: "Commercial Invoice",
  description: "Invoice document",
  isActive: true,
  fieldId: "bbbbbbbb-1111-1111-1111-111111111111",
  fieldKey: "invoice_number",
  fieldLabel: "Invoice Number",
  fieldDataType: "number",
  fieldIsRequired: true,
  fieldSortOrder: 1,
  fieldIsIdentifier: false,
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("groupEntityTypeRows", () => {
  it("Test 1: collapses two rows with same entity-type slug into one object with two fields in sortOrder order", () => {
    const rows = [ROW_BILL_FIELD_1, ROW_BILL_FIELD_2];
    const result = groupEntityTypeRows(rows);

    expect(result).toHaveLength(1);
    const billOfLading = result[0]!;
    expect(billOfLading.slug).toBe("bill_of_lading");
    expect(billOfLading.label).toBe("Bill of Lading");
    expect(billOfLading.description).toBe("Shipping document");
    expect(billOfLading.fields).toHaveLength(2);
    expect(billOfLading.fields[0]!.key).toBe("shipper_name");
    expect(billOfLading.fields[1]!.key).toBe("consignee_name");
    // Phase-9 additive contract: ids + isActive + per-field metadata exposed.
    expect(billOfLading.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(billOfLading.isActive).toBe(true);
    expect(billOfLading.fields[0]!.id).toBe("aaaaaaaa-1111-1111-1111-111111111111");
    expect(billOfLading.fields[0]!.sortOrder).toBe(1);
    expect(billOfLading.fields[0]!.isIdentifier).toBe(false);
    expect(billOfLading.fields[1]!.isIdentifier).toBe(true);
  });

  it("Test 1b: a deactivated entity type with no fields surfaces isActive=false", () => {
    const result = groupEntityTypeRows([ROW_NO_FIELDS]);
    expect(result[0]!.isActive).toBe(false);
    expect(result[0]!.id).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("Test 2: a row with null fieldKey (entity type with no fields) yields { ..., fields: [] }", () => {
    const rows = [ROW_NO_FIELDS];
    const result = groupEntityTypeRows(rows);

    expect(result).toHaveLength(1);
    const unknownType = result[0]!;
    expect(unknownType.slug).toBe("unknown_type");
    expect(unknownType.fields).toHaveLength(0);
    expect(unknownType.description).toBeNull();
  });

  it("Test 3: returns a new array and new field objects (does not mutate input rows)", () => {
    const rows = [ROW_BILL_FIELD_1, ROW_BILL_FIELD_2];
    const result1 = groupEntityTypeRows(rows);
    const result2 = groupEntityTypeRows(rows);

    // Different array references
    expect(result1).not.toBe(result2);

    // Different nested field object references
    expect(result1[0]!.fields[0]).not.toBe(result2[0]!.fields[0]);

    // Input rows are unmodified (check first row as proxy)
    expect(rows[0]).toEqual(ROW_BILL_FIELD_1);
    expect(rows[1]).toEqual(ROW_BILL_FIELD_2);
  });

  it("Test 4: dataType maps from fieldType column; isRequired passes through unchanged", () => {
    const rows = [ROW_INVOICE];
    const result = groupEntityTypeRows(rows);

    const field = result[0]!.fields[0]!;
    expect(field.dataType).toBe("number");
    expect(field.isRequired).toBe(true);
    expect(field.key).toBe("invoice_number");
    expect(field.label).toBe("Invoice Number");
  });

  it("Test 5: multiple entity types preserve insertion order (label-sorted by DB, maintained by helper)", () => {
    // DB returns in label order; groupEntityTypeRows must preserve that order
    const rows = [ROW_BILL_FIELD_1, ROW_NO_FIELDS];
    const result = groupEntityTypeRows(rows);

    expect(result).toHaveLength(2);
    expect(result[0]!.slug).toBe("bill_of_lading");
    expect(result[1]!.slug).toBe("unknown_type");
  });
});
