import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { Emails } from "@polytoken/db/schema";

import { createTRPCRouter, publicProcedure } from "../../trpc";
import { emailDetailProcedures } from "./detail";
import { emailEntitySummaryProcedures } from "./entity-summary";
import { componentMutationProcedures } from "./mutations";

/**
 * The reading-preview snippet length — the inbox list projects bodyText
 * truncated to this many chars server-side (matches the client slice) so a large
 * body is never streamed to the inbox.
 */
const INBOX_SNIPPET_CHARS = 2000;

/**
 * emailsRouter — read-only access to the append-only `emails` table.
 *
 * No auth: these are public queries against the Drizzle `db` handle in context.
 */
export const emailsRouter = createTRPCRouter({
  ...emailDetailProcedures,
  ...emailEntitySummaryProcedures,
  ...componentMutationProcedures,
  /**
   * List emails, newest first. Optional `importerId` filter and limit/offset
   * pagination. Returns rows plus a `hasMore` hint for cursor-less paging.
   */
  list: publicProcedure
    .input(
      z
        .object({
          importerId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({ limit: 50, offset: 0 }),
    )
    .query(async ({ ctx, input }) => {
      // Explicit column projection — the inbox list never renders bodyHtml or
      // the raw storage key, so they are NOT fetched (a single email body can be
      // large). bodyText is truncated server-side to the snippet length the
      // reading preview shows (2000 chars) rather than streaming the full body.
      const rows = await ctx.db
        .select({
          id: Emails.id,
          subject: Emails.subject,
          senderName: Emails.senderName,
          senderAddress: Emails.senderAddress,
          toAddresses: Emails.toAddresses,
          receivedAt: Emails.receivedAt,
          importerId: Emails.importerId,
          bodyText: sql<
            string | null
          >`left(${Emails.bodyText}, ${INBOX_SNIPPET_CHARS})`,
        })
        .from(Emails)
        .where(
          input.importerId ? eq(Emails.importerId, input.importerId) : undefined,
        )
        .orderBy(desc(Emails.receivedAt))
        .limit(input.limit + 1)
        .offset(input.offset);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;

      return {
        items,
        hasMore,
        nextOffset: input.offset + items.length,
      };
    }),

  /**
   * Fetch a single email by id, or null if not found.
   */
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(Emails)
        .where(eq(Emails.id, input.id))
        .limit(1);

      return rows[0] ?? null;
    }),
});
