/**
 * Phase 4 — Email Intelligence: retrieval trace / link tables (RESEARCH §3.9).
 *
 * Two link tables record what retrieval found for each component — full audit
 * trail for every extraction decision:
 *
 *   component_knowledge_node_links — which knowledge nodes were retrieved and
 *     whether they were injected into the extraction prompt.
 *
 *   component_entity_candidate_links — which entity_instance candidates were
 *     surfaced for this component, their match type, and which was selected.
 */

import {
  boolean,
  index,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { EmailComponents } from "./components";
import { EntityInstances } from "./entity-instances";
import { EntityTypes } from "./entity-types";
import { KnowledgeNodes } from "./knowledge-nodes";

// ---------------------------------------------------------------------------
// component_knowledge_node_links
// ---------------------------------------------------------------------------
export const ComponentKnowledgeNodeLinks = pgTable(
  "component_knowledge_node_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    componentId: uuid("component_id")
      .notNull()
      .references(() => EmailComponents.id, { onDelete: "cascade" }),

    knowledgeNodeId: uuid("knowledge_node_id")
      .notNull()
      .references(() => KnowledgeNodes.id, { onDelete: "cascade" }),

    similarityScore: real("similarity_score").notNull(),

    // 'vector' | 'bm25' | 'hybrid_rrf'
    retrievalMethod: text("retrieval_method"),

    usedInExtraction: boolean("used_in_extraction").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    componentKnowledgeNodeUnique: unique(
      "component_knowledge_node_links_component_node_unique",
    ).on(t.componentId, t.knowledgeNodeId),
    componentKnowledgeNodeComponentIdx: index(
      "idx_component_knowledge_node_links_component_id",
    ).on(t.componentId),
  }),
);

// ---------------------------------------------------------------------------
// component_entity_candidate_links
// ---------------------------------------------------------------------------
export const ComponentEntityCandidateLinks = pgTable(
  "component_entity_candidate_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    componentId: uuid("component_id")
      .notNull()
      .references(() => EmailComponents.id, { onDelete: "cascade" }),

    entityInstanceId: uuid("entity_instance_id")
      .notNull()
      .references(() => EntityInstances.id, { onDelete: "cascade" }),

    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => EntityTypes.id),

    similarityScore: real("similarity_score").notNull(),

    // 'semantic' | 'identifier_exact' | 'identifier_fuzzy' | 'alias'
    matchType: text("match_type"),

    wasSelected: boolean("was_selected").notNull().default(false),

    // D-20 reject: a surfaced duplicate suggestion the human dismissed; the
    // resolver never re-surfaces a dismissed link.
    wasDismissed: boolean("was_dismissed").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    componentEntityCandidateUnique: unique(
      "component_entity_candidate_links_component_entity_unique",
    ).on(t.componentId, t.entityInstanceId),
    componentEntityCandidateComponentIdx: index(
      "idx_component_entity_candidate_links_component_id",
    ).on(t.componentId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ComponentKnowledgeNodeLinkRow =
  typeof ComponentKnowledgeNodeLinks.$inferSelect;
export type InsertComponentKnowledgeNodeLink =
  typeof ComponentKnowledgeNodeLinks.$inferInsert;

export type ComponentEntityCandidateLinkRow =
  typeof ComponentEntityCandidateLinks.$inferSelect;
export type InsertComponentEntityCandidateLink =
  typeof ComponentEntityCandidateLinks.$inferInsert;
