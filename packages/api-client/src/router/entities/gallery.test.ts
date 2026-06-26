/**
 * gallery.test.ts — unit tests for the entities.list pure helper and input schema.
 *
 * DB-free: shapeGalleryItem is an exported pure helper tested without a DB connection.
 * Schema tests verify the Zod allow-lists, defaults, and bounds.
 *
 * Test plan:
 *   Test 1: shapeGalleryItem maps raw row fields to the gallery item shape.
 *   Test 2: shapeGalleryItem is immutable — does not mutate the input row.
 *   Test 3: listInputSchema status enum allows exactly the four D-02/D-14 values.
 *   Test 4: listInputSchema status default is 'confirmed' (D-02 candidates hidden).
 *   Test 5: listInputSchema sort enum allows last_seen | name | occurrences.
 *   Test 6: listInputSchema limit capped at max 100, min 1.
 *   Test 7: listInputSchema search capped at max 200 characters.
 *   Test 8: listInputSchema rejects status outside the allow-list.
 *   Test 9: listInputSchema rejects sort outside the allow-list.
 */

import { describe, expect, it } from "vitest";

import { listInputSchema, shapeGalleryItem, type GalleryRawRow } from "./gallery";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_ROW: GalleryRawRow = {
  id: "00000000-0000-0000-0000-000000000001",
  displayName: "Acme Corp",
  entityTypeId: "00000000-0000-0000-0000-000000000002",
  entityTypeLabel: "Shipper",
  identifiers: { po_number: "PO-1234" },
  lastSeen: new Date("2024-01-15T00:00:00Z"),
  isActive: true,
  nautaId: null,
  occurrenceCount: 3,
  pendingDuplicatesCount: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("shapeGalleryItem", () => {
  it("Test 1: maps raw row fields to the gallery item shape", () => {
    const item = shapeGalleryItem(BASE_ROW);

    expect(item.id).toBe(BASE_ROW.id);
    expect(item.displayName).toBe("Acme Corp");
    expect(item.entityTypeId).toBe(BASE_ROW.entityTypeId);
    expect(item.entityTypeLabel).toBe("Shipper");
    expect(item.keyIdentifiers).toEqual({ po_number: "PO-1234" });
    expect(item.occurrenceCount).toBe(3);
    expect(item.lastSeen).toStrictEqual(new Date("2024-01-15T00:00:00Z"));
    expect(item.pendingDuplicatesCount).toBe(1);
    // status: confirmed when isActive=true and nautaId=null (email_extracted confirmed)
    expect(item.status).toBe("confirmed");
  });

  it("Test 2: does not mutate the input row (immutability)", () => {
    const snapshot = JSON.stringify(BASE_ROW);
    shapeGalleryItem(BASE_ROW);
    expect(JSON.stringify(BASE_ROW)).toBe(snapshot);
  });

  it("Test 2b: status is 'candidate' when isActive is false", () => {
    const row: GalleryRawRow = { ...BASE_ROW, isActive: false };
    const item = shapeGalleryItem(row);
    expect(item.status).toBe("candidate");
  });
});

describe("listInputSchema — status", () => {
  it("Test 3: allows all four D-02/D-14 status values", () => {
    for (const s of ["confirmed", "all", "candidate", "has-pending-duplicates"] as const) {
      const parsed = listInputSchema.parse({ status: s });
      expect(parsed.status).toBe(s);
    }
  });

  it("Test 4: default status is 'confirmed' (D-02 candidates hidden by default)", () => {
    const parsed = listInputSchema.parse({});
    expect(parsed.status).toBe("confirmed");
  });

  it("Test 8: rejects status outside the allow-list", () => {
    expect(() => listInputSchema.parse({ status: "unknown" })).toThrow();
  });
});

describe("listInputSchema — sort", () => {
  it("Test 5: allows last_seen | name | occurrences", () => {
    for (const s of ["last_seen", "name", "occurrences"] as const) {
      const parsed = listInputSchema.parse({ sort: s });
      expect(parsed.sort).toBe(s);
    }
  });

  it("Test 5b: default sort is 'last_seen'", () => {
    const parsed = listInputSchema.parse({});
    expect(parsed.sort).toBe("last_seen");
  });

  it("Test 9: rejects sort outside the allow-list", () => {
    expect(() => listInputSchema.parse({ sort: "invalid_sort" })).toThrow();
  });
});

describe("listInputSchema — bounds", () => {
  it("Test 6: limit defaults to 25, min 1, max 100", () => {
    expect(listInputSchema.parse({}).limit).toBe(25);
    expect(() => listInputSchema.parse({ limit: 0 })).toThrow();
    expect(() => listInputSchema.parse({ limit: 101 })).toThrow();
    expect(listInputSchema.parse({ limit: 100 }).limit).toBe(100);
  });

  it("Test 7: search max 200 characters", () => {
    // 200 chars ok
    expect(() =>
      listInputSchema.parse({ search: "a".repeat(200) }),
    ).not.toThrow();
    // 201 chars rejected
    expect(() =>
      listInputSchema.parse({ search: "a".repeat(201) }),
    ).toThrow();
  });
});
