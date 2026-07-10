/**
 * forwarding/index.ts — forwardingRouter (THRD-04, web half, Plan 45-06).
 *
 * `getOrCreateMyAddress` is the caller's single get-or-create entry point for
 * their personal secret-token forwarding address: `u-{token}@{domain}`. The
 * FastAPI side (Plan 45-05) only RESOLVES tokens at ingest time — token
 * *generation* lives here because users live in the web app.
 *
 * Security (T-45-06-01/02/03, threat register):
 *   - protectedProcedure — userId is ALWAYS ctx.user.id, never client input.
 *     There is no `.input()` at all on this procedure: there is nothing for
 *     an attacker to supply.
 *   - token is generated via Node's CSPRNG (`crypto.randomBytes`), never
 *     Math.random or any non-cryptographic source.
 *   - get-or-create is idempotent under concurrency: the DB's
 *     UNIQUE(user_id) index (Plan 45-01) is the source of truth; a
 *     conflicting concurrent insert resolves via onConflictDoNothing + a
 *     re-select, never a duplicate row or a thrown constraint error bubbling
 *     to the client.
 *   - FORWARDING_EMAIL_DOMAIN is read at CALL TIME (not module init, mirrors
 *     `_listener-config.ts`'s `getListenerConfig` idiom) so a missing var
 *     fails loudly the moment it's needed rather than baking a blank/invalid
 *     address into a response.
 *   - the token/address is never logged (T-45-06-02) — this module contains
 *     zero console.* calls.
 */

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { ForwardingAddresses } from "@polytoken/db/schema";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

// ---------------------------------------------------------------------------
// Pure helpers — exported for DB-free unit testing (mirrors
// resolveListScope / resolveDefaultModelId elsewhere in this router tree).
// ---------------------------------------------------------------------------

/** >=128 bits of entropy is the plan's floor; 256 bits leaves ample margin. */
const TOKEN_ENTROPY_BYTES = 32;

/**
 * generateForwardingToken — a CSPRNG-derived, URL/email-local-part-safe
 * token. base64url has no `+`/`/`/`=` characters, so the result is safe to
 * embed directly in an email local-part (`u-{token}@...`) with no further
 * encoding.
 */
export function generateForwardingToken(): string {
  return randomBytes(TOKEN_ENTROPY_BYTES).toString("base64url");
}

/**
 * getForwardingDomain — reads FORWARDING_EMAIL_DOMAIN at call time (T-45-06-03).
 * Throws a clear, specific error when absent so a misconfigured deployment
 * fails loudly instead of building a blank/invalid `u-{token}@` address.
 */
export function getForwardingDomain(): string {
  const domain = process.env.FORWARDING_EMAIL_DOMAIN;
  if (!domain) {
    throw new Error("FORWARDING_EMAIL_DOMAIN is not configured");
  }
  return domain;
}

/**
 * buildForwardingAddress — the seam's address contract (Plan 45-01/45-05):
 * the `u-` local-part prefix + token. Keep in sync with the FastAPI
 * resolver's `token_from_recipient` (45-05), which parses this same prefix.
 */
export function buildForwardingAddress(token: string, domain: string): string {
  return `u-${token}@${domain}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const forwardingRouter = createTRPCRouter({
  /**
   * getOrCreateMyAddress — returns the caller's forwarding token + full
   * address, creating the row on first call (idempotent get-or-create keyed
   * on the DB's UNIQUE(user_id) index). No input: userId comes exclusively
   * from ctx.user (protectedProcedure — UNAUTHORIZED without a session).
   */
  getOrCreateMyAddress: protectedProcedure.query(async ({ ctx }) => {
    const domain = getForwardingDomain();

    const existing = await ctx.db
      .select({ token: ForwardingAddresses.token })
      .from(ForwardingAddresses)
      .where(eq(ForwardingAddresses.userId, ctx.user.id))
      .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
      return {
        token: existingRow.token,
        address: buildForwardingAddress(existingRow.token, domain),
      };
    }

    const token = generateForwardingToken();
    const inserted = await ctx.db
      .insert(ForwardingAddresses)
      .values({ userId: ctx.user.id, token })
      .onConflictDoNothing({ target: ForwardingAddresses.userId })
      .returning({ token: ForwardingAddresses.token });

    const insertedRow = inserted[0];
    if (insertedRow) {
      return {
        token: insertedRow.token,
        address: buildForwardingAddress(insertedRow.token, domain),
      };
    }

    // Lost a concurrent race (onConflictDoNothing skipped the insert) — the
    // winning insert's row is now readable; re-select rather than error.
    const reread = await ctx.db
      .select({ token: ForwardingAddresses.token })
      .from(ForwardingAddresses)
      .where(eq(ForwardingAddresses.userId, ctx.user.id))
      .limit(1);

    const rereadRow = reread[0];
    if (!rereadRow) {
      throw new Error("Failed to get or create forwarding address");
    }
    return {
      token: rereadRow.token,
      address: buildForwardingAddress(rereadRow.token, domain),
    };
  }),
});
