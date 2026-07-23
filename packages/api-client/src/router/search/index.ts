/**
 * router/search/index.ts — the `search` tRPC router (AI-05, search-mode
 * first increment of the cross-surface omnibox).
 *
 * ONE procedure, `search.omnibox`, fans a single query string out to five
 * arms and returns a flat, typed result list the Cmd/Ctrl+K omnibox groups
 * by kind:
 *
 *   entity        — entity_instances (displayName / aliases / identifiers
 *                   ILIKE — the exact predicate entities/gallery.ts uses,
 *                   T-10-32 bound-parameter posture included)
 *   email         — emails (subject / senderName / senderAddress ILIKE)
 *   conversation  — chat_conversations (title ILIKE, DIRECT user_id scope)
 *   knowledge     — the KG-8 seam: match_knowledge_nodes_by_trgm per owned
 *                   importer, merged via mergeKnowledgeSearchRows (reused
 *                   from ../knowledge/search — one copy of that logic)
 *   file          — the vault adapter's root-folder page, name-filtered
 *                   in-process (structurally user-scoped: every storage key
 *                   derives from ctx.user.id via vaultKey)
 *
 * TENANCY (TENA-03) — every arm is scoped exactly like its home router:
 *   - entity / email / knowledge arms derive scope from
 *     `userOwnedImporterIds(ctx.db, ctx.user.id)` + `resolveListScope`; an
 *     owner-less caller gets EMPTY arms with ZERO queries issued.
 *   - conversation arm filters `chat_conversations.user_id = ctx.user.id`
 *     directly (mirrors chat/conversations.ts — conversations are NOT
 *     importer-anchored, so this arm still works for an importer-less user).
 *   - file arm is structurally scoped: the adapter builds keys from
 *     ctx.user.id only; no client input ever names a key or prefix.
 *
 * ORDERING (documented choice): ARM-PRIORITY, not a cross-arm score. The
 * arms' native rankings are incomparable (trgm similarity for knowledge,
 * recency for emails/conversations, name order for files), so inventing a
 * unified score would be false precision. Results are ordered by
 * OMNIBOX_KIND_ORDER (entities first — they are the smallest, most
 * name-shaped corpus, so a name query hitting one is almost always the
 * intent) with each arm's own native order preserved inside its group. The
 * UI groups by kind anyway, so this ordering IS the display order.
 *
 * VECTOR ARM (deliberately absent, seam documented): halfvec embeddings
 * exist (entity_instances.embedding, knowledge_nodes.embedding) and the
 * dense RPCs exist (match_entities_by_embedding,
 * match_knowledge_nodes_by_embedding — migrations 0017/0029/0043), but all
 * of them need a QUERY embedding, which is computed listener-side via
 * Bedrock (EmbeddingProtocol). Same seam knowledge/search.ts documents for
 * KG-8: once a listener HTTP endpoint exposes query-embedding, fuse the
 * dense arms in via RRF here. Until then this is honestly trgm/ILIKE-only.
 *
 * DEGRADATION (documented choice): each arm is individually caught —
 * a single arm's infra failure (e.g. vault storage unreachable, trgm RPC
 * missing on a stale local DB) logs loudly server-side and contributes an
 * empty group, instead of blanking all five surfaces at once.
 *
 * T-37-05 posture: all SQL goes through drizzle builders or the `sql` tag
 * with bound parameters — never string concatenation.
 */

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { userOwnedImporterIds } from "@polytoken/db/ownership";
import {
  ChatConversations,
  Emails,
  EntityInstances,
  EntityTypes,
} from "@polytoken/db/schema";

import type { VaultAdapter } from "../files/storage-adapter";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { createServiceRoleVaultClient, VAULT_BUCKET } from "../files/service-client";
import { createVaultAdapter } from "../files/storage-adapter";
import {
  mergeKnowledgeSearchRows,
  type KnowledgeSearchRow,
} from "../knowledge/search";
import { resolveListScope } from "../_scope";

// ---------------------------------------------------------------------------
// Input schema — exported for DB-free testing
// ---------------------------------------------------------------------------

/**
 * Mirrors searchKnowledgeInputSchema's 200-char bound on user text.
 * `limitPerKind` caps EACH arm (five arms × 20 max = a bounded payload).
 */
export const omniboxSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(200),
  limitPerKind: z.number().int().min(1).max(20).default(5),
});

export type OmniboxSearchInput = z.infer<typeof omniboxSearchInputSchema>;

// ---------------------------------------------------------------------------
// Result shape — the omnibox's whole vocabulary
// ---------------------------------------------------------------------------

/** Display/merge order — see ORDERING in the module doc. */
export const OMNIBOX_KIND_ORDER = [
  "entity",
  "email",
  "conversation",
  "knowledge",
  "file",
] as const;

export type OmniboxResultKind = (typeof OMNIBOX_KIND_ORDER)[number];

export interface OmniboxResult {
  readonly kind: OmniboxResultKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  /**
   * App-relative deep link. /emails/[id], /entities/[id] and /files?path=
   * resolve today; /knowledge?node= and /chat?c= land on the right surface
   * but the surfaces do not yet read those params (documented handoff —
   * both pages keep selection in local state as of Phase 61).
   */
  readonly href: string;
}

// ---------------------------------------------------------------------------
// Pure merge helper — exported for DB-free testing
// ---------------------------------------------------------------------------

/**
 * mergeOmniboxResults — flattens per-kind arm results into one list in
 * OMNIBOX_KIND_ORDER, preserving each arm's native internal order. No
 * cross-kind dedupe (ids are only unique within a kind). Never mutates
 * its inputs.
 */
export function mergeOmniboxResults(
  byKind: Partial<Record<OmniboxResultKind, ReadonlyArray<OmniboxResult>>>,
): OmniboxResult[] {
  const merged: OmniboxResult[] = [];
  for (const kind of OMNIBOX_KIND_ORDER) {
    merged.push(...(byKind[kind] ?? []));
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Per-arm degradation guard
// ---------------------------------------------------------------------------

/**
 * settleArm — runs one arm, mapping any failure to an empty group with a
 * loud server-side log (see DEGRADATION in the module doc). The arm name in
 * the log is what makes a silently-empty group diagnosable.
 */
async function settleArm(
  arm: OmniboxResultKind,
  run: () => Promise<OmniboxResult[]>,
): Promise<OmniboxResult[]> {
  try {
    return await run();
  } catch (err) {
    console.error(`[search.omnibox] ${arm} arm failed:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * @param opts.vaultAdapter — injected by tests (mirrors createFilesRouter).
 * Production passes nothing and gets the service-role adapter, resolved
 * LAZILY per call so importing this router never requires storage secrets.
 */
export function createSearchRouter(opts?: { vaultAdapter?: VaultAdapter }) {
  const adapter = (): VaultAdapter =>
    opts?.vaultAdapter ??
    createVaultAdapter({
      client: createServiceRoleVaultClient(),
      bucket: VAULT_BUCKET,
    });

  return createTRPCRouter({
    /**
     * omnibox — cross-surface search. Read-only; every arm owned-scoped
     * (see module doc). Returns `{ results }` flat in OMNIBOX_KIND_ORDER.
     */
    omnibox: protectedProcedure
      .input(omniboxSearchInputSchema)
      .query(async ({ ctx, input }) => {
        const term = `%${input.query}%`;
        const limit = input.limitPerKind;

        const owned = await userOwnedImporterIds(ctx.db, ctx.user.id);
        const scope = resolveListScope(owned, undefined);

        // -----------------------------------------------------------------
        // Importer-scoped arms — skipped entirely (zero queries) when the
        // caller owns no importers, exactly like their home routers.
        // -----------------------------------------------------------------

        const entityArm = !scope.ok
          ? Promise.resolve([])
          : settleArm("entity", async () => {
              const rows = await ctx.db
                .select({
                  id: EntityInstances.id,
                  displayName: EntityInstances.displayName,
                  entityTypeLabel: EntityTypes.label,
                })
                .from(EntityInstances)
                .leftJoin(
                  EntityTypes,
                  eq(EntityTypes.id, EntityInstances.entityTypeId),
                )
                .where(
                  and(
                    // T-10-31 posture: always email_extracted, confirmed only
                    eq(EntityInstances.source, "email_extracted"),
                    eq(EntityInstances.isActive, true),
                    isNull(EntityInstances.nautaId),
                    inArray(EntityInstances.importerId, scope.importerIds),
                    // The gallery's exact trgm-backed predicate (T-10-32:
                    // bound parameters, never interpolation).
                    sql`(${EntityInstances.displayName} ILIKE ${term}
                      OR ${EntityInstances.identifiers}::text ILIKE ${term}
                      OR EXISTS (
                        SELECT 1 FROM unnest(${EntityInstances.aliases}) AS alias
                        WHERE alias ILIKE ${term}
                      ))`,
                  ),
                )
                .orderBy(desc(EntityInstances.createdAt))
                .limit(limit);

              return rows.map(
                (row): OmniboxResult => ({
                  kind: "entity",
                  id: row.id,
                  title: row.displayName,
                  ...(row.entityTypeLabel !== null
                    ? { subtitle: row.entityTypeLabel }
                    : {}),
                  href: `/entities/${row.id}`,
                }),
              );
            });

        const emailArm = !scope.ok
          ? Promise.resolve([])
          : settleArm("email", async () => {
              const rows = await ctx.db
                .select({
                  id: Emails.id,
                  subject: Emails.subject,
                  senderName: Emails.senderName,
                  senderAddress: Emails.senderAddress,
                })
                .from(Emails)
                .where(
                  and(
                    inArray(Emails.importerId, scope.importerIds),
                    sql`(${Emails.subject} ILIKE ${term}
                      OR ${Emails.senderName} ILIKE ${term}
                      OR ${Emails.senderAddress} ILIKE ${term})`,
                  ),
                )
                .orderBy(desc(Emails.receivedAt))
                .limit(limit);

              return rows.map(
                (row): OmniboxResult => ({
                  kind: "email",
                  id: row.id,
                  title: row.subject ?? "(no subject)",
                  ...(row.senderName ?? row.senderAddress
                    ? { subtitle: (row.senderName ?? row.senderAddress)! }
                    : {}),
                  href: `/emails/${row.id}`,
                }),
              );
            });

        const knowledgeArm = !scope.ok
          ? Promise.resolve([])
          : settleArm("knowledge", async () => {
              // The KG-8 seam verbatim: one RPC per owned importer (the SQL
              // function is per-importer by design), merged + ranked by the
              // shared helper. EXTRACTED-tier-only is enforced inside the
              // function (migration 0029's belt 3).
              const pages = await Promise.all(
                scope.importerIds.map(async (importerId) => {
                  const rows = await ctx.db.execute(
                    sql`SELECT id, title, content, scope, scope_ref_id, tier, confidence, sim
                        FROM match_knowledge_nodes_by_trgm(${input.query}, ${importerId}::uuid, ${limit})`,
                  );
                  return rows as unknown as KnowledgeSearchRow[];
                }),
              );

              return mergeKnowledgeSearchRows(pages, limit).map(
                (item): OmniboxResult => ({
                  kind: "knowledge",
                  id: item.id,
                  title:
                    item.title ??
                    (item.content !== null && item.content.length > 0
                      ? item.content.slice(0, 80)
                      : "Untitled note"),
                  ...(item.tier !== null ? { subtitle: item.tier } : {}),
                  href: `/knowledge?node=${item.id}`,
                }),
              );
            });

        // -----------------------------------------------------------------
        // User-scoped arms — run even for an importer-less caller.
        // -----------------------------------------------------------------

        const conversationArm = settleArm("conversation", async () => {
          const rows = await ctx.db
            .select({
              id: ChatConversations.id,
              title: ChatConversations.title,
            })
            .from(ChatConversations)
            .where(
              and(
                // T-44-07-01: DIRECT user scope, never importer-derived.
                eq(ChatConversations.userId, ctx.user.id),
                sql`${ChatConversations.title} ILIKE ${term}`,
              ),
            )
            .orderBy(desc(ChatConversations.updatedAt))
            .limit(limit);

          return rows.map(
            (row): OmniboxResult => ({
              kind: "conversation",
              id: row.id,
              title: row.title,
              href: `/chat?c=${row.id}`,
            }),
          );
        });

        const fileArm = settleArm("file", async () => {
          // First page of the caller's vault ROOT (500 entries — deeper than
          // any honest root folder), name-filtered in-process. Storage has no
          // server-side name search; a recursive walk per keystroke would be
          // an amplifier. Structurally tenant-safe: listFolder derives its
          // prefix from ctx.user.id via vaultKey — no client-named key exists.
          const page = await adapter().listFolder(ctx.user.id, [], 0);
          const needle = input.query.toLowerCase();

          return page.entries
            .filter(
              (entry) =>
                !entry.isFolder &&
                entry.name.toLowerCase().includes(needle),
            )
            .slice(0, limit)
            .map(
              (entry): OmniboxResult => ({
                kind: "file",
                id: entry.name,
                title: entry.name,
                subtitle: entry.kind,
                href: "/files",
              }),
            );
        });

        const [entities, emails, conversations, knowledge, files] =
          await Promise.all([
            entityArm,
            emailArm,
            conversationArm,
            knowledgeArm,
            fileArm,
          ]);

        return {
          results: mergeOmniboxResults({
            entity: entities,
            email: emails,
            conversation: conversations,
            knowledge,
            file: files,
          }),
        };
      }),
  });
}

/** The production instance root.ts mounts. */
export const searchRouter = createSearchRouter();
