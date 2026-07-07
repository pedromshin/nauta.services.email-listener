/**
 * Phase 4 — Email Intelligence: knowledge_nodes table (D-15, RESEARCH §3.6).
 *
 * A knowledge node is a named chunk of context attached to entity types,
 * specific entity instances, or senders. Encodes importer-specific rules —
 * either written manually or synthesised automatically from reviewer
 * corrections. The embedding enables semantic retrieval (S4–S6).
 *
 * moddatetime trigger on updated_at is added via custom SQL migration.
 * HNSW halfvec_cosine_ops index is added via custom SQL migration.
 */

import {
  boolean,
  index,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { halfvec } from "./_halfvec";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// knowledge_node_scope enum (RESEARCH §3.6)
// ---------------------------------------------------------------------------
export const knowledgeNodeScopeEnum = pgEnum("knowledge_node_scope", [
  "entity_type",
  "entity_instance",
  "sender",
  "importer_global",
]);

// ---------------------------------------------------------------------------
// knowledge_trust_tier enum (Phase 29 — TIER-01, ordinal trust ladder)
//
// Ordinal semantics (most -> least trusted):
//   EXTRACTED — human-confirmed via the review UI (most trust; the only tier
//               ever eligible for prompt auto-injection, Phase 30 TIER-02/03)
//   INFERRED  — synthesis-derived suggestion, not yet human-reviewed
//   AMBIGUOUS — default / least trust (fail-toward-least-trust on write)
//
// Independent of the existing `confidence real` column, which remains the
// intra-tier similarity/quality score — tier and confidence answer different
// questions (provenance trust vs. match quality).
// ---------------------------------------------------------------------------
export const knowledgeTrustTierEnum = pgEnum("knowledge_trust_tier", [
  "EXTRACTED",
  "INFERRED",
  "AMBIGUOUS",
]);

// ---------------------------------------------------------------------------
// knowledge_nodes
// ---------------------------------------------------------------------------
export const KnowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    content: text("content").notNull(),

    scope: knowledgeNodeScopeEnum("scope").notNull(),
    // UUID of the entity_type, entity_instance, or sender_profile it applies to
    scopeRefId: uuid("scope_ref_id"),
    scopeRefType: text("scope_ref_type"),

    // How this node originated
    source: text("source").notNull().default("manual"),

    confidence: real("confidence").notNull().default(1.0),

    // Ordinal trust tier (Phase 29 — TIER-01). See knowledgeTrustTierEnum doc
    // comment above for ordinal semantics. Independent of `confidence`.
    tier: knowledgeTrustTierEnum("tier").notNull().default("AMBIGUOUS"),

    // halfvec(1536) — semantic embedding for retrieval (RESEARCH §3.6, §4.1)
    // HNSW index added via custom SQL migration (drizzle-kit cannot emit halfvec_cosine_ops)
    embedding: halfvec("embedding", { dimensions: 1536 }),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // moddatetime BEFORE UPDATE trigger added via custom SQL migration
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    knowledgeNodeImporterScopeIdx: index(
      "idx_knowledge_nodes_importer_scope",
    ).on(t.importerId, t.scope),
    knowledgeNodeImporterActiveIdx: index(
      "idx_knowledge_nodes_importer_active",
    ).on(t.importerId, t.isActive),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type KnowledgeNodeRow = typeof KnowledgeNodes.$inferSelect;
export type InsertKnowledgeNode = typeof KnowledgeNodes.$inferInsert;
