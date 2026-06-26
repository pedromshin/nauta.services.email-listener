/**
 * Phase 4 — Email Intelligence: entity_types + entity_type_fields tables.
 *
 * entity_types define what kinds of structured documents the system can
 * extract (e.g. "bill_of_lading", "commercial_invoice"). Eight default types
 * are seeded with importer_id = NULL via a custom SQL migration.
 *
 * entity_type_fields define the individual fields within each entity type.
 *
 * Multi-tenant: importer_id = NULL means "system default" (shared);
 * importer_id = <uuid> means "importer-specific override".
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { halfvec } from "./_halfvec";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// entity_types
// ---------------------------------------------------------------------------
export const EntityTypes = pgTable(
  "entity_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // NULL = system default; uuid = importer-specific
    importerId: uuid("importer_id").references(() => Importers.id, {
      onDelete: "cascade",
    }),

    // Machine-readable key, e.g. "bill_of_lading"
    slug: text("slug").notNull(),
    // Human label, e.g. "Bill of Lading"
    label: text("label").notNull(),
    description: text("description"),

    // Semantic embedding of the entity type description for similarity search
    embedding: halfvec("embedding", { dimensions: 1536 }),

    // Arbitrary JSON config (extraction prompt hints, field ordering, etc.)
    config: jsonb("config").notNull().default({}),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Composite uniqueness for importer-scoped (non-NULL importer_id) rows.
    // NOTE: standard SQL UNIQUE treats NULL as distinct, so this constraint does
    // NOT prevent duplicate SYSTEM-DEFAULT types (importer_id IS NULL) — those are
    // guarded by the partial unique index below (migration 0014, HIGH-2).
    importerSlugUnique: unique("entity_types_importer_id_slug_unique").on(
      t.importerId,
      t.slug,
    ),
    // HIGH-2: enforce slug uniqueness for system-default entity types
    // (importer_id IS NULL), which the composite UNIQUE above cannot (NULL != NULL).
    systemSlugUnique: uniqueIndex("uniq_entity_types_system_slug")
      .on(t.slug)
      .where(sql`${t.importerId} IS NULL`),
    entityTypesImporterIdx: index("idx_entity_types_importer_id").on(
      t.importerId,
    ),
    entityTypesSlugIdx: index("idx_entity_types_slug").on(t.slug),
    // HNSW index for embedding similarity search added via custom SQL migration
  }),
);

// ---------------------------------------------------------------------------
// entity_type_fields
// ---------------------------------------------------------------------------
export const EntityTypeFields = pgTable(
  "entity_type_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => EntityTypes.id, { onDelete: "cascade" }),

    importerId: uuid("importer_id").references(() => Importers.id, {
      onDelete: "cascade",
    }),

    // Machine key within the entity, e.g. "shipper_name"
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    description: text("description"),

    // JSON Schema type hint: "string" | "number" | "date" | "array" | "object"
    fieldType: text("field_type").notNull().default("string"),
    isRequired: boolean("is_required").notNull().default(false),
    // Display order within the entity type form / extraction output
    sortOrder: integer("sort_order").notNull().default(0),

    // Arbitrary validation / extraction hints
    config: jsonb("config").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // MEDIUM-3: per-entity-type slug uniqueness at the DB level (was app-only,
    // a TOCTOU window). The use cases keep their pre-checks for the friendly 409;
    // this is the real backstop. (entity_type_id, slug) is non-NULL on both
    // columns, so the standard composite UNIQUE is sufficient here.
    fieldEntityTypeSlugUnique: unique(
      "entity_type_fields_entity_type_id_slug_unique",
    ).on(t.entityTypeId, t.slug),
    fieldEntityTypeIdx: index("idx_entity_type_fields_entity_type_id").on(
      t.entityTypeId,
    ),
    fieldImporterIdx: index("idx_entity_type_fields_importer_id").on(
      t.importerId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type EntityTypeRow = typeof EntityTypes.$inferSelect;
export type InsertEntityType = typeof EntityTypes.$inferInsert;

export type EntityTypeFieldRow = typeof EntityTypeFields.$inferSelect;
export type InsertEntityTypeField = typeof EntityTypeFields.$inferInsert;
