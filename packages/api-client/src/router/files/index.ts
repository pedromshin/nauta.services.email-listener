/**
 * router/files/index.ts — the `files` tRPC router (Phase 66 Plan 02).
 *
 * The /files vault's five procedures. ALL of them are `protectedProcedure`,
 * and on every one of them the acting user is `ctx.user.id` — never an input
 * field, never a header, never a default.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE INPUT RULE, WHICH IS THE WHOLE TENANCY ARGUMENT:
 * no procedure input may contain a `userId`, a `key`, a `bucket`, or a
 * `prefix`. The client sends validated RELATIVE SEGMENTS and receives a URL;
 * it never chooses where anything lands. If a future need seems to call for
 * one of those fields, that is the signal to STOP, not to add the field.
 * Two independent gates hold this: `files-tenancy.test.ts` (behavioural — zod
 * strips unknown keys, so an impersonation attempt is ignored) and
 * `files-inputs.test.ts` (source-level — the one that survives a refactor).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WIRING: `root.ts` is ORCHESTRATOR-RESERVED and is not touched by this lane
 * (LANE-CONTRACTS). It gains exactly one line at merge:
 *
 *     files: filesRouter,        // import { filesRouter } from "./router/files";
 *
 * Until then the surface reaches these procedures through the temporary
 * `vault-api` seam (D-66-03, `apps/web/src/app/files/_lib/vault-api.tsx`).
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { VaultAdapter } from "./storage-adapter";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { createServiceRoleVaultClient, VAULT_BUCKET } from "./service-client";
import {
  createVaultAdapter,
  VAULT_LIST_PAGE_SIZE,
  VAULT_MAX_UPLOAD_BYTES,
  VaultStorageError,
} from "./storage-adapter";
import { VaultNameSchema, VaultPathSchema } from "./vault-keys";

/**
 * Turn any adapter failure into a generic client-facing error.
 *
 * The real `{ op, message }` goes to the server log; the client gets a fixed
 * string. Storage error text names KEYS and BUCKETS — echoing it to the
 * browser hands an attacker the vault's internal layout for free (T-66-07).
 *
 * Fail-closed, no existence oracle: a missing object and someone else's object
 * are indistinguishable from outside, because both produce this same error.
 */
function toClientError(err: unknown): never {
  if (err instanceof TRPCError) throw err;

  if (err instanceof VaultStorageError) {
    console.error(`[files] storage error during ${err.op}:`, err.message);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong reaching your files.",
    });
  }

  // A `vaultKey`/zod throw lands here: the input got past the procedure's own
  // schema but the chokepoint refused it. That is a BAD_REQUEST, and the fact
  // that it is reachable at all is the deliberate belt-and-braces of Plan 01's
  // re-parse — not dead code.
  console.error("[files] unexpected error:", err);
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "That request wasn't valid.",
  });
}

/**
 * @param opts.adapter - injected by the tests. Production passes nothing and
 * gets the service-role adapter, resolved LAZILY (see below).
 */
export function createFilesRouter(opts?: { adapter?: VaultAdapter }) {
  /**
   * Resolved per call, not at module load. Importing this router must never
   * require secrets — otherwise the whole package's test run and the build
   * both fail at import time, for reasons that look nothing like the cause.
   */
  const adapter = (): VaultAdapter =>
    opts?.adapter ??
    createVaultAdapter({
      client: createServiceRoleVaultClient(),
      bucket: VAULT_BUCKET,
    });

  return createTRPCRouter({
    /**
     * One PAGE of a folder's contents. `path` defaults to the vault root.
     *
     * `cursor` is the field tRPC's `useInfiniteQuery` echoes back — it MUST
     * accept null (tRPC's initialCursor default) and it is bounded: an offset
     * is not a key or a prefix (the input rule above stands untouched), but an
     * unbounded one is still a free amplifier against storage. 2000 pages of
     * 500 is deeper than any honest vault.
     */
    list: protectedProcedure
      .input(
        z.object({
          path: VaultPathSchema,
          cursor: z
            .number()
            .int()
            .min(0)
            .max(VAULT_LIST_PAGE_SIZE * 2000)
            .nullish(),
        }),
      )
      .query(async ({ ctx, input }) => {
        try {
          return await adapter().listFolder(ctx.user.id, input.path, input.cursor ?? 0);
        } catch (err) {
          return toClientError(err);
        }
      }),

    createFolder: protectedProcedure
      .input(z.object({ path: VaultPathSchema, name: VaultNameSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          await adapter().createFolder(ctx.user.id, input.path, input.name);
          return { ok: true as const };
        } catch (err) {
          return toClientError(err);
        }
      }),

    /**
     * Mint a signed upload URL. The browser PUTs to it directly.
     *
     * `size.max()` is T-66-05's SERVER-SIDE half and it is the enforcement —
     * the client's pre-check (Plan 04) is a courtesy so the user is told
     * before a 100MB transfer. The bucket's own `fileSizeLimit` is the third
     * layer, and the only one the client cannot lie past at all. All three
     * cite `VAULT_MAX_UPLOAD_BYTES`; none restates the number.
     */
    requestUpload: protectedProcedure
      .input(
        z.object({
          path: VaultPathSchema,
          name: VaultNameSchema,
          size: z.number().int().positive().max(VAULT_MAX_UPLOAD_BYTES),
          // Stored by storage; NEVER trusted for a rendering decision
          // (D-66-04). Bounded so it cannot be used as a payload smuggler.
          contentType: z.string().max(255).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          return await adapter().signedUploadUrl(ctx.user.id, input.path, input.name);
        } catch (err) {
          return toClientError(err);
        }
      }),

    /** `{ url }` and nothing else, ever (T-66-07). */
    requestDownload: protectedProcedure
      .input(z.object({ path: VaultPathSchema, name: VaultNameSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await adapter().signedDownloadUrl(ctx.user.id, input.path, input.name);
        } catch (err) {
          return toClientError(err);
        }
      }),

    remove: protectedProcedure
      .input(
        z.object({
          path: VaultPathSchema,
          name: VaultNameSchema,
          isFolder: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          await adapter().removeEntry(ctx.user.id, input.path, input.name, input.isFolder);
          return { ok: true as const };
        } catch (err) {
          return toClientError(err);
        }
      }),
  });
}

/** What the orchestrator's one-line `root.ts` wiring imports. */
export const filesRouter = createFilesRouter();
