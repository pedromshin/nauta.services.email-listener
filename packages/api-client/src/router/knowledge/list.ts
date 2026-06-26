/**
 * knowledge/list.ts — the `knowledge.list` tRPC procedure.
 *
 * Paginated feed of active knowledge_nodes, optionally filtered by importerId.
 * Uses limit+1 pagination (D-06 / entities/gallery.ts analog).
 *
 * D-09: Read-only — zero writes to knowledge_node_edges or any table.
 * D-12: importerId is an OPTIONAL data filter applied via eq() — never a
 *        trusted caller claim.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { KnowledgeNodes } from "@nauta/db/schema";

import { publicProcedure } from "../../trpc";

// ---------------------------------------------------------------------------
// Input schema — exported for DB-free testing
// ---------------------------------------------------------------------------

export const listKnowledgeInputSchema = z.object({
  importerId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export type ListKnowledgeInput = z.infer<typeof listKnowledgeInputSchema>;

// ---------------------------------------------------------------------------
// List procedure
// ---------------------------------------------------------------------------

export const knowledgeListProcedures = {
  /**
   * list — paginated knowledge_nodes feed (active nodes only).
   *
   * Returns { items, hasMore, nextOffset } with limit+1 detection.
   * Ordered by createdAt desc (most-recently-added first).
   *
   * D-12: importerId is an optional data filter — never a session/header claim.
   */
  list: publicProcedure
    .input(listKnowledgeInputSchema)
    .query(async ({ ctx, input }) => {
      const whereClauses = [eq(KnowledgeNodes.isActive, true)];

      if (input.importerId !== undefined) {
        whereClauses.push(eq(KnowledgeNodes.importerId, input.importerId));
      }

      // limit+1 pattern to detect hasMore
      const rawRows = await ctx.db
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
          createdAt: KnowledgeNodes.createdAt,
        })
        .from(KnowledgeNodes)
        .where(and(...whereClauses))
        .orderBy(desc(KnowledgeNodes.createdAt))
        .limit(input.limit + 1)
        .offset(input.offset);

      const hasMore = rawRows.length > input.limit;
      const sliced = hasMore ? rawRows.slice(0, input.limit) : rawRows;

      const items = sliced.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        scope: row.scope,
        scopeRefId: row.scopeRefId,
        scopeRefType: row.scopeRefType,
        source: row.source,
        confidence: row.confidence,
        importerId: row.importerId,
        createdAt: row.createdAt,
      }));

      return {
        items,
        hasMore,
        nextOffset: input.offset + items.length,
      };
    }),
};
