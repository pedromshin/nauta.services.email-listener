/**
 * Phase 4 — Email Intelligence: entity_instances table (RESEARCH §3.8).
 * Phase 10 — Repurposed as the cross-email identity store (D-03/D-04).
 *
 * Originally a lightweight Nauta-entity mirror. Phase 10 widens the purpose:
 * rows may now be email-extracted (nauta_id NULL, source='email_extracted') or
 * Nauta-synced (nauta_id set, source='nauta_sync'). The source discriminator
 * drives gallery queries (D-17) and RPC filters (D-07/D-12).
 *
 * HNSW halfvec_cosine_ops index on embedding is added via custom SQL migration.
 * GIN pg_trgm indexes on (identifiers::text), display_name, and aliases are
 * added via custom SQL migrations (drizzle-kit cannot emit expression indexes).
 * Partial unique indexes (WHERE nauta_id IS NOT NULL) live in migration 0016.
 */

import {
  type AnyPgColumn,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { halfvec } from "./_halfvec";
import { EntityTypes } from "./entity-types";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// entity_instances — cross-email identity store (email_extracted | nauta_sync)
// ---------------------------------------------------------------------------
export const EntityInstances = pgTable(
  "entity_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => EntityTypes.id),

    // Stable Nauta record ID — NULL for email-extracted rows (D-04)
    nautaId: text("nauta_id"),

    // Discriminator: 'email_extracted' (Phase-10 rows) | 'nauta_sync' (legacy mirror)
    source: text("source").notNull().default("email_extracted"),

    displayName: text("display_name").notNull(),

    // {po_number: "PO-1234", invoice_number: "INV-99"}
    // pg_trgm GIN index on identifiers::text added via custom SQL migration
    identifiers: jsonb("identifiers").notNull().default({}),

    // Known alternate spellings / typos / OCR variants (D-11 flywheel write-back)
    aliases: text("aliases").array(),

    summaryText: text("summary_text"),

    // halfvec(1536): embed(display_name + summary_text + key identifiers) [RESEARCH §3.8]
    // HNSW index added via custom SQL migration
    embedding: halfvec("embedding", { dimensions: 1536 }),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),

    // Merge linkage (D-20 curation): when this identity is merged INTO a
    // surviving identity, points to that survivor's id. NULL = not merged.
    // Self-FK; the detail page derives `wasMerged` via EXISTS(merged_into = id).
    mergedInto: uuid("merged_into").references(
      (): AnyPgColumn => EntityInstances.id,
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Gallery path index for (importer_id, entity_type_id, source) — D-17
    entityInstanceGalleryIdx: index("idx_entity_instances_gallery").on(
      t.importerId,
      t.entityTypeId,
      t.source,
    ),
    entityInstanceImporterEntityTypeIdx: index(
      "idx_entity_instances_importer_entity_type",
    ).on(t.importerId, t.entityTypeId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type EntityInstanceRow = typeof EntityInstances.$inferSelect;
export type InsertEntityInstance = typeof EntityInstances.$inferInsert;
