/**
 * _scope.ts — shared pure helper deciding which importer ids a list-style
 * read is allowed to query (TENA-03, Phase 44).
 *
 * Same semantics as `resolveListScope` in emails/index.ts (44-05), extracted
 * here so the entities and knowledge routers (44-06) share ONE copy instead
 * of re-deriving the allow/deny matrix per router (mirrors the
 * `_ownership.ts` / `_listener-config.ts` shared-helper idiom in this
 * directory).
 *
 * - No requested importerId: scope to the caller's FULL owned set.
 * - Requested importerId IN the owned set: narrow to just that one id (an
 *   explicit filter the caller asked for, validated against ownership
 *   first).
 * - Requested importerId NOT in the owned set (or the caller owns nothing):
 *   `{ ok: false }` — the caller must get an empty result, never a query
 *   built from an unverified id.
 *
 * DB-free and framework-agnostic; exported for direct unit testing.
 */

export type ListScope =
  | { readonly ok: true; readonly importerIds: ReadonlyArray<string> }
  | { readonly ok: false };

export function resolveListScope(
  owned: ReadonlyArray<string>,
  requestedImporterId: string | undefined,
): ListScope {
  if (owned.length === 0) {
    return { ok: false };
  }
  if (requestedImporterId === undefined) {
    return { ok: true, importerIds: owned };
  }
  if (!owned.includes(requestedImporterId)) {
    return { ok: false };
  }
  return { ok: true, importerIds: [requestedImporterId] };
}
