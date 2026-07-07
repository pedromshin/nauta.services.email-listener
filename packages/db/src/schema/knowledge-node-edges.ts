/**
 * Phase 11 — Knowledge Graph: knowledge_node_edges table (D-05, UI-SPEC §4e).
 *
 * Stores explicit directed edges between knowledge nodes and arbitrary target
 * entities (polymorphic target). The source_node_id FK enforces referential
 * integrity; target_ref_id is intentionally unconstrained (same idiom as
 * knowledge_nodes.scope_ref_id) to support future target entity types without
 * schema migrations.
 *
 * Today the table is populated by manual / synthesis workflows only.
 * Derived edges (component↔entity_instance via ComponentEntityCandidateLinks,
 * component↔knowledge_node via ComponentKnowledgeNodeLinks) are computed at
 * query time by the graph tRPC procedure — NOT stored here.
 *
 * Read-only enforcement (D-09): no insert/update procedures are exposed via tRPC
 * in Phase 11. All writes come from direct DB scripts or future synthesis jobs.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { KnowledgeNodes, knowledgeTrustTierEnum } from "./knowledge-nodes";

// ---------------------------------------------------------------------------
// knowledge_node_edges
// ---------------------------------------------------------------------------
export const KnowledgeNodeEdges = pgTable(
  "knowledge_node_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceNodeId: uuid("source_node_id")
      .notNull()
      .references(() => KnowledgeNodes.id, { onDelete: "cascade" }),

    // Polymorphic target — no FK constraint (mirrors knowledge_nodes.scope_ref_id idiom)
    targetRefId: uuid("target_ref_id"),
    targetRefType: text("target_ref_type"),

    relationType: text("relation_type").notNull().default("related"),
    confidence: real("confidence").notNull().default(1.0),

    // How this edge originated: "manual" | "synthesis" | "learned_from_correction"
    source: text("source").notNull().default("manual"),

    // Ordinal trust tier (Phase 29 — TIER-01). See knowledgeTrustTierEnum doc
    // comment (knowledge-nodes.ts) for ordinal semantics.
    tier: knowledgeTrustTierEnum("tier").notNull().default("AMBIGUOUS"),

    // OCR token-polygon provenance (Phase 29 — SYNTH-02), populated in 29-03:
    // { component_id, page_index, polygon, tokens }.
    provenance: jsonb("provenance"),

    // Supersede flag (Phase 29 — SYNTH-03): re-confirm deactivates the prior
    // confirmation's edges and writes fresh ones (never DELETE — audit trail
    // preserved). Mirrors KnowledgeNodes.isActive.
    isActive: boolean("is_active").notNull().default(true),

    // Human-promotion provenance (Phase 30 — TIER-03), distinct from the
    // synthesis `provenance` column above: { promoted_at, from_tier,
    // mechanism }. Written ONLY by the guarded promote_edge repo method when
    // a human reviewer flips an active INFERRED/AMBIGUOUS edge to EXTRACTED.
    promotion: jsonb("promotion"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    knowledgeNodeEdgesSourceIdx: index(
      "idx_knowledge_node_edges_source_node_id",
    ).on(t.sourceNodeId),
    knowledgeNodeEdgesTargetIdx: index(
      "idx_knowledge_node_edges_target_ref_id",
    ).on(t.targetRefId),
    // Deterministic active-edge identity (Phase 29 — SYNTH-03) supporting
    // supersede: at most one active edge per (source, target, relation).
    knowledgeNodeEdgesActiveIdentityIdx: index(
      "idx_knowledge_node_edges_active_identity",
    )
      .on(t.sourceNodeId, t.targetRefId, t.relationType)
      .where(sql`is_active`),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type KnowledgeNodeEdgeRow = typeof KnowledgeNodeEdges.$inferSelect;
export type InsertKnowledgeNodeEdge = typeof KnowledgeNodeEdges.$inferInsert;
