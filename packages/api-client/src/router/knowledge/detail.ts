/**
 * knowledge/detail.ts — the `knowledge.byId` tRPC procedure.
 *
 * Returns one active knowledge_node row + its outgoing knowledge_node_edges.
 * Returns null when the node does not exist or is inactive (never throws).
 *
 * D-09: Read-only — zero writes to knowledge_node_edges.
 * D-12: no importerId scoping needed for byId (the node id is the scope);
 *        importerId is available on the returned row for the caller.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { KnowledgeNodeEdges, KnowledgeNodes } from "@polytoken/db/schema";

import { publicProcedure } from "../../trpc";

// ---------------------------------------------------------------------------
// Detail procedure
// ---------------------------------------------------------------------------

export const knowledgeDetailProcedures = {
  /**
   * byId — fetch one knowledge_node (isActive) with its edges.
   *
   * Returns null when the node is missing or inactive — never throws.
   * edges is an empty array today (knowledge_node_edges has 0 rows).
   */
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Fetch the knowledge node (isActive scoped)
      const nodeRows = await ctx.db
        .select({
          id: KnowledgeNodes.id,
          title: KnowledgeNodes.title,
          content: KnowledgeNodes.content,
          scope: KnowledgeNodes.scope,
          scopeRefId: KnowledgeNodes.scopeRefId,
          scopeRefType: KnowledgeNodes.scopeRefType,
          source: KnowledgeNodes.source,
          confidence: KnowledgeNodes.confidence,
          importerId: KnowledgeNodes.importerId,
          isActive: KnowledgeNodes.isActive,
          createdAt: KnowledgeNodes.createdAt,
          updatedAt: KnowledgeNodes.updatedAt,
        })
        .from(KnowledgeNodes)
        .where(
          and(
            eq(KnowledgeNodes.id, input.id),
            eq(KnowledgeNodes.isActive, true),
          ),
        )
        .limit(1);

      if (!nodeRows[0]) return null;

      const node = nodeRows[0];

      // Fetch outgoing edges from the knowledge_node_edges table (D-11 seam)
      // Empty today — contributes 0 edges. No writes.
      const edgeRows = await ctx.db
        .select({
          id: KnowledgeNodeEdges.id,
          sourceNodeId: KnowledgeNodeEdges.sourceNodeId,
          targetRefId: KnowledgeNodeEdges.targetRefId,
          targetRefType: KnowledgeNodeEdges.targetRefType,
          relationType: KnowledgeNodeEdges.relationType,
          confidence: KnowledgeNodeEdges.confidence,
          source: KnowledgeNodeEdges.source,
          createdAt: KnowledgeNodeEdges.createdAt,
        })
        .from(KnowledgeNodeEdges)
        .where(eq(KnowledgeNodeEdges.sourceNodeId, input.id));

      const edges = edgeRows.map((row) => ({ ...row }));

      return {
        node: { ...node },
        edges,
      };
    }),
};
