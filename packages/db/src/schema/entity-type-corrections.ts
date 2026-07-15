/**
 * Phase 57 — Email Learning Loop (LEARN-01): entity_type_corrections table.
 *
 * `SetComponentEntityTypeUseCase` previously overwrote a component's
 * `entity_type_id` with zero audit trail. This table captures every genuine
 * reclassification (prior type existed AND differs from the new type) as a
 * durable, addressable row — mirroring `extraction_records.corrected_fields`'s
 * "structured, addressable correction" shape (D-16), but for the entity-type
 * axis instead of the field-value axis.
 *
 * Retrieval (Plan 57-02's few-shot consumer) uses the importer-scoped
 * `match_entity_type_corrections_by_trgm` RPC (migration for this table) —
 * NOT a Drizzle query — so this file only needs to mirror the table shape
 * for `drizzle-kit check` to stay green.
 */

import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { EmailComponents } from "./components";
import { EntityTypes } from "./entity-types";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// entity_type_corrections
// ---------------------------------------------------------------------------
export const EntityTypeCorrections = pgTable(
  "entity_type_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    componentId: uuid("component_id")
      .notNull()
      .references(() => EmailComponents.id, { onDelete: "cascade" }),

    previousEntityTypeId: uuid("previous_entity_type_id")
      .notNull()
      .references(() => EntityTypes.id),

    correctedEntityTypeId: uuid("corrected_entity_type_id")
      .notNull()
      .references(() => EntityTypes.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    entityTypeCorrectionsImporterIdx: index(
      "idx_entity_type_corrections_importer_id",
    ).on(t.importerId),
    entityTypeCorrectionsComponentIdx: index(
      "idx_entity_type_corrections_component_id",
    ).on(t.componentId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type EntityTypeCorrectionRow = typeof EntityTypeCorrections.$inferSelect;
export type InsertEntityTypeCorrection =
  typeof EntityTypeCorrections.$inferInsert;
