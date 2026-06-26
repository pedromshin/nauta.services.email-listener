/**
 * Phase 4 — Email Intelligence: extraction_records table (D-16).
 *
 * An extraction record is the result of applying an entity type to a component.
 * Records are versioned and supersedable (D-16): when a component is
 * reprocessed, prior records gain status="superseded" and a new record is
 * inserted. The moddatetime trigger keeps updated_at current.
 *
 * correctedFields holds human / reviewer overrides layered on top of
 * extractedFields — never mutates the original extracted JSON.
 */

import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { extractionStatusEnum } from "./enums";
import { EmailComponents } from "./components";
import { EntityTypes } from "./entity-types";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// extraction_records
// ---------------------------------------------------------------------------
export const ExtractionRecords = pgTable(
  "extraction_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    componentId: uuid("component_id")
      .notNull()
      .references(() => EmailComponents.id, { onDelete: "cascade" }),

    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => EntityTypes.id, { onDelete: "restrict" }),

    // -- Extraction output --
    /**
     * Raw field values produced by the LLM extraction pipeline.
     * Shape: { [fieldSlug: string]: unknown }
     */
    extractedFields: jsonb("extracted_fields").notNull().default({}),

    /**
     * Human / reviewer overrides layered on top of extractedFields.
     * Immutable overlay: original extractedFields is never mutated.
     * Shape: { [fieldSlug: string]: unknown }
     */
    correctedFields: jsonb("corrected_fields"),

    /**
     * LLM retrieval context captured at extraction time for auditability.
     * Shape: { model: string; prompt_tokens: number; completion_tokens: number;
     *          retrieval_chunks?: { component_id: string; score: number }[] }
     */
    retrievalContext: jsonb("retrieval_context"),

    // -- Confidence scoring --
    // Composite confidence in [0, 1] produced by the extraction pipeline
    confidenceScore: numeric("confidence_score", {
      precision: 5,
      scale: 4,
    }),

    /**
     * Per-field confidence values produced by the extraction pipeline.
     * Shape: { [fieldSlug: string]: number }
     */
    confidenceBreakdown: jsonb("confidence_breakdown"),

    // Why this record was routed/created, e.g. "cold_start_autofill",
    // "few_shot_autofill", "human_confirmation" — auditability for D-16.
    routingReason: text("routing_reason"),

    // -- Lifecycle (D-16) --
    status: extractionStatusEnum("status").notNull().default("candidate"),

    // -- Traceability --
    // Free-text note from human reviewer
    reviewerNote: text("reviewer_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    extractionComponentIdx: index("idx_extraction_records_component_id").on(
      t.componentId,
    ),
    extractionEntityTypeIdx: index(
      "idx_extraction_records_entity_type_id",
    ).on(t.entityTypeId),
    extractionImporterIdx: index("idx_extraction_records_importer_id").on(
      t.importerId,
    ),
    extractionStatusIdx: index("idx_extraction_records_status").on(t.status),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ExtractionRecordRow = typeof ExtractionRecords.$inferSelect;
export type InsertExtractionRecord = typeof ExtractionRecords.$inferInsert;
