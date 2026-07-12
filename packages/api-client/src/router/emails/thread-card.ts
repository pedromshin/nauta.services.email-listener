/**
 * emails.threadCard — the single-thread projection the `EmailThreadNode`
 * canvas card fetches (CLUS-01, Phase 54 Plan 01, 54-UI-SPEC.md Component
 * 1): real subject, participants, and a latest-message summary for ONE
 * thread — never a list.
 *
 * Scoping mirrors `emails.listThreads` (T-45-04-01 idiom, T-54-01-02):
 * `userOwnedImporterIds` resolves the caller's owned importers, and the
 * query filters BOTH `thread_id = :threadId` AND `importer_id = ANY(owned)`
 * — the threadId alone is never trusted for scope, so a foreign or unknown
 * threadId yields `null`, never another tenant's rows and never a throw
 * (T-54-01-02, T-54-01-04).
 *
 * DoS bounds reuse the same constants `emails.listThreads` established
 * (THREAD_SNIPPET_CHARS, MAX_SCAN_ROWS) — a single-thread scan is already
 * bounded by threadId, but MAX_SCAN_ROWS caps it further as defense in
 * depth against a pathologically large thread (T-54-01-04). No
 * MEMBER_EMAIL_ID_CAP equivalent is needed here — this procedure never
 * returns a list of member ids, only aggregate stats derived from the
 * capped row scan.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { Emails } from "@polytoken/db/schema";
import { userOwnedImporterIds } from "@polytoken/db/ownership";

import { protectedProcedure } from "../../trpc";
import { MAX_SCAN_ROWS, THREAD_SNIPPET_CHARS } from "./list-threads";

/** Participant display names shown before collapsing the rest into "+{n} more". */
const MAX_PARTICIPANTS_SHOWN = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One flat member-email row feeding the pure derivation helper. */
export interface ThreadCardEmailRow {
  readonly id: string;
  readonly subject: string | null;
  readonly senderName: string | null;
  readonly senderAddress: string;
  readonly receivedAt: Date;
  readonly snippet: string | null;
}

/** The derived, DB-free portion of a thread card. */
export interface DerivedThreadCard {
  readonly subject: string | null;
  readonly participantsSummary: string;
  readonly latestSnippet: string | null;
  readonly latestMessageId: string;
  readonly messageCount: number;
}

/** The full procedure response shape — DerivedThreadCard plus the threadId
 * the caller asked for (round-tripped so the client never has to thread it
 * through separately). */
export type ThreadCard = DerivedThreadCard & { readonly threadId: string };

// ---------------------------------------------------------------------------
// Pure helper — exported for DB-free unit testing
// ---------------------------------------------------------------------------

function senderDisplayName(row: ThreadCardEmailRow): string {
  const trimmed = row.senderName?.trim();
  return trimmed ? trimmed : row.senderAddress;
}

/**
 * deriveThreadCard — collapse a thread's flat member-email rows into one
 * card. Never mutates its input; returns null for an empty row list (an
 * empty/unknown/not-owned thread — the router maps this to a clean `null`
 * response, never a throw).
 *
 * - subject/latestSnippet/latestMessageId are sourced from the row with the
 *   greatest `(receivedAt, id)` tuple (same deterministic tie-break idiom
 *   `groupEmailsIntoThreads` uses, kept consistent across the stack).
 * - participantsSummary joins up to `MAX_PARTICIPANTS_SHOWN` deduped sender
 *   display names (most-recent-first), then appends " +{n} more" for the
 *   remainder — the exact `resolveFooterCopy`/`ProvenanceLink` dedupe idiom
 *   54-UI-SPEC.md's Component 1 specifies.
 */
export function deriveThreadCard(
  rows: ReadonlyArray<ThreadCardEmailRow>,
): DerivedThreadCard | null {
  if (rows.length === 0) {
    return null;
  }

  const orderedNewestFirst = [...rows].sort((a, b) => {
    const byDate = b.receivedAt.getTime() - a.receivedAt.getTime();
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });
  const latest = orderedNewestFirst[0]!;

  const dedupedNames: string[] = [];
  for (const row of orderedNewestFirst) {
    const name = senderDisplayName(row);
    if (!dedupedNames.includes(name)) {
      dedupedNames.push(name);
    }
  }

  const shown = dedupedNames.slice(0, MAX_PARTICIPANTS_SHOWN);
  const overflow = dedupedNames.length - shown.length;
  const participantsSummary =
    overflow > 0 ? `${shown.join(", ")} +${overflow} more` : shown.join(", ");

  return {
    subject: latest.subject,
    participantsSummary,
    latestSnippet: latest.snippet,
    latestMessageId: latest.id,
    messageCount: rows.length,
  };
}

// ---------------------------------------------------------------------------
// Procedures — spread into emailsRouter
// ---------------------------------------------------------------------------

export const emailThreadCardProcedures = {
  /**
   * threadCard — one thread's real subject/participants/summary, scoped to
   * the caller's owned importers. Returns null (never throws) for an
   * owner-less caller, a foreign threadId, or an unknown/empty thread.
   */
  threadCard: protectedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<ThreadCard | null> => {
      const owned = await userOwnedImporterIds(ctx.db, ctx.user.id);
      if (owned.length === 0) {
        return null;
      }

      const rows = await ctx.db
        .select({
          id: Emails.id,
          subject: Emails.subject,
          senderName: Emails.senderName,
          senderAddress: Emails.senderAddress,
          receivedAt: Emails.receivedAt,
          snippet: sql<
            string | null
          >`left(${Emails.bodyText}, ${THREAD_SNIPPET_CHARS})`,
        })
        .from(Emails)
        .where(
          and(eq(Emails.threadId, input.threadId), inArray(Emails.importerId, owned)),
        )
        .orderBy(desc(Emails.receivedAt))
        .limit(MAX_SCAN_ROWS);

      const card = deriveThreadCard(rows);
      if (!card) {
        return null;
      }

      return { threadId: input.threadId, ...card };
    }),
};
