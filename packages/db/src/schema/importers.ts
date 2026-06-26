/**
 * Phase 4 — Email Intelligence: importers table (tenant / multi-tenant boundary).
 *
 * Every domain table carries importer_id FK → importers.id (D-05).
 * importer_id = null on system defaults (entity_types seed rows) only.
 */

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// importers — one row per customer / forwarding sender
// ---------------------------------------------------------------------------
export const Importers = pgTable("importers", {
  id: uuid("id").primaryKey().defaultRandom(),

  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),

  // Importer-level rule hints (per-importer LLM prompt cache configuration)
  config: jsonb("config").notNull().default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ImporterRow = typeof Importers.$inferSelect;
export type InsertImporter = typeof Importers.$inferInsert;
