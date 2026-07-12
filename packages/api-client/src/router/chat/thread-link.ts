/**
 * chat/thread-link.ts — durable thread<->conversation linkage (CLUS-02,
 * Phase 54 Plan 01, migration 0036). Canvas sharedState is explicitly NOT
 * the linkage store (54-CONTEXT.md) — this table-level column is, so the
 * link survives canvas changes and is readable at chat-turn time server-side
 * (the context-assembly consumer lands in a later plan).
 *
 * Migration 0036 is AUTHORED but APPLIED TO NO ENVIRONMENT tonight
 * (Docker/WSL down). Every procedure here gates through
 * `../_column-detect`'s `tableColumnExists` BEFORE touching `thread_id`, and
 * additionally wraps the actual write/read in a try/catch for a live
 * Postgres UndefinedColumn (42703) — defense in depth against a stale cache
 * entry or a race with the morning migration-apply flow (T-54-01-05).
 *
 * Security (T-54-01-01): both procedures assert conversation ownership via
 * `assertConversationOwnership` BEFORE any thread_id read/write
 * (fail-closed NOT_FOUND, same idiom as conversations.ts's
 * rename/delete/setModel). threadId/conversationId are validated as
 * z.string().uuid() at the boundary; all queries are parameterized Drizzle
 * builders — no string interpolation.
 */

import { eq } from "drizzle-orm";
import { z } from "zod";

import { assertConversationOwnership } from "@polytoken/db/ownership";
import { ChatConversations } from "@polytoken/db/schema";

import { protectedProcedure } from "../../trpc";
import { assertOwnedOrNotFound } from "../_ownership";
import { tableColumnExists } from "../_column-detect";

const CHAT_CONVERSATIONS_TABLE = "chat_conversations";
const THREAD_ID_COLUMN = "thread_id";

/** Postgres error code for "column does not exist" (0036 unapplied). */
const UNDEFINED_COLUMN_ERROR_CODE = "42703";

function isUndefinedColumnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === UNDEFINED_COLUMN_ERROR_CODE
  );
}

// ---------------------------------------------------------------------------
// Input schemas — exported for DB-free testing
// ---------------------------------------------------------------------------

export const attachConversationToThreadInputSchema = z.object({
  conversationId: z.string().uuid(),
  threadId: z.string().uuid(),
});
export type AttachConversationToThreadInput = z.infer<
  typeof attachConversationToThreadInputSchema
>;

export const getConversationThreadIdInputSchema = z.object({
  conversationId: z.string().uuid(),
});
export type GetConversationThreadIdInput = z.infer<
  typeof getConversationThreadIdInputSchema
>;

/** Returned by attachConversationToThread — a discriminated-by-shape result
 * rather than a thrown error, since "linkage unavailable" (0036 unapplied)
 * is an expected, non-exceptional state tonight. */
export type AttachConversationToThreadResult =
  | { readonly attached: true }
  | { readonly attached: false; readonly reason: "linkage_unavailable" };

const LINKAGE_UNAVAILABLE: AttachConversationToThreadResult = {
  attached: false,
  reason: "linkage_unavailable",
};

// ---------------------------------------------------------------------------
// Procedures — spread into chatRouter
// ---------------------------------------------------------------------------

export const chatThreadLinkProcedures = {
  /**
   * attachConversationToThread — sets chat_conversations.thread_id for an
   * owned conversation. Returns { attached: false, reason:
   * "linkage_unavailable" } (never throws) when migration 0036 hasn't
   * landed yet in this environment.
   */
  attachConversationToThread: protectedProcedure
    .input(attachConversationToThreadInputSchema)
    .mutation(
      async ({ ctx, input }): Promise<AttachConversationToThreadResult> => {
        await assertOwnedOrNotFound(() =>
          assertConversationOwnership(ctx.db, input.conversationId, ctx.user.id),
        );

        const columnExists = await tableColumnExists(
          ctx.db,
          CHAT_CONVERSATIONS_TABLE,
          THREAD_ID_COLUMN,
        );
        if (!columnExists) {
          return LINKAGE_UNAVAILABLE;
        }

        try {
          await ctx.db
            .update(ChatConversations)
            .set({ threadId: input.threadId, updatedAt: new Date() })
            .where(eq(ChatConversations.id, input.conversationId));
          return { attached: true };
        } catch (error) {
          if (isUndefinedColumnError(error)) {
            return LINKAGE_UNAVAILABLE;
          }
          throw error;
        }
      },
    ),

  /**
   * getConversationThreadId — reads the linked thread id for an owned
   * conversation. Returns { threadId: null } (never throws) both when no
   * thread is linked AND when migration 0036 hasn't landed yet.
   */
  getConversationThreadId: protectedProcedure
    .input(getConversationThreadIdInputSchema)
    .query(async ({ ctx, input }): Promise<{ threadId: string | null }> => {
      await assertOwnedOrNotFound(() =>
        assertConversationOwnership(ctx.db, input.conversationId, ctx.user.id),
      );

      const columnExists = await tableColumnExists(
        ctx.db,
        CHAT_CONVERSATIONS_TABLE,
        THREAD_ID_COLUMN,
      );
      if (!columnExists) {
        return { threadId: null };
      }

      try {
        const rows = await ctx.db
          .select({ threadId: ChatConversations.threadId })
          .from(ChatConversations)
          .where(eq(ChatConversations.id, input.conversationId))
          .limit(1);
        return { threadId: rows[0]?.threadId ?? null };
      } catch (error) {
        if (isUndefinedColumnError(error)) {
          return { threadId: null };
        }
        throw error;
      }
    }),
};
