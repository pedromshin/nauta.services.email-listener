"use client";

/**
 * use-data-bindings.ts — resolves a genui spec's `bindings` record into live
 * tRPC query data via a compile-time switch over exactly the 5 already-
 * allowlisted procedures wired this phase (Phase 33, BIND-01 + the staleTime
 * half of BIND-02).
 *
 * Sits ABOVE the locked renderer chain (`spec-renderer.tsx`, `render-node.tsx`,
 * `genui-part-boundary.tsx`) — none of those files are touched. This hook is
 * standalone in this plan (33-01); wiring it into `genui-panel-node.tsx`'s
 * `GenuiPanelNodeBody` happens in 33-02.
 *
 * Security posture (T-33-01 / T-33-02, see 33-01-PLAN.md threat_model):
 *   - The 3 by-id procedures (`entities.byId`, `emails.detail`,
 *     `knowledge.byId`) source their id ONLY from `panelData` (render
 *     context) — NEVER from `binding.params`, which is model-authored and
 *     therefore untrusted for identity selection. When the render-context id
 *     is absent, the query is disabled (never fired) and the binding
 *     resolves to `undefined`.
 *   - `entities.list` / `knowledge.graph` accept model-authored non-ID
 *     params from `binding.params` (already UUID-refined by
 *     `DataBindingSchema`, GR-15), but `importerId` is ALWAYS sourced from
 *     `panelData.importerId ?? DEFAULT_IMPORTER_ID` — stripped from
 *     `binding.params` before use even though the schema-level UUID refine
 *     already blocks it (defense-in-depth, two independent layers).
 *
 * Params-from-context convention (locked table, 33-CONTEXT.md):
 *   | procedure       | id/importer source           |
 *   |------------------|-------------------------------|
 *   | entities.byId    | panelData.selectedEntityId    |
 *   | emails.detail    | panelData.selectedEmailId     |
 *   | knowledge.byId   | panelData.selectedNodeId      |
 *   | entities.list    | binding.params pass-through   |
 *   | knowledge.graph  | binding.params pass-through, importerId ALWAYS from panelData |
 *
 * Degrade-instead-of-throw posture (mirrors `useCanvasSpec`'s `EMPTY_SPEC`
 * fallback and `GenuiPartBoundary`'s `SAFE_FALLBACK_SPEC` gate, D-04): any
 * parse/streaming/validation failure resolves to `{}` — never throws.
 */

import { z } from "zod";

import { DataBindingSchema, type AllowedProcedure } from "@nauta/genui/schema";
import type { DataBinding } from "@nauta/genui/schema";

import { attemptRepairJson } from "../_components/genui-part-boundary";
import { api } from "~/trpc/react";

// ---------------------------------------------------------------------------
// DataBindingsQueryProxy — a narrow structural view of the trpc-react-query
// `t` proxy `api.useQueries` hands its callback, scoped to only the 5 wired
// procedures' call signatures.
//
// Why this exists: `api.useQueries`'s real generic signature infers a fixed
// POSITIONAL TUPLE type from the callback's return expression (designed for
// a statically-known, literal-array call site like
// `api.useQueries((t) => [t.a.x(...), t.b.y(...)])`). This hook instead
// builds a DYNAMIC, runtime-length array — the binding count varies with
// however many entries the streamed spec has declared so far — mixing 5
// procedures with structurally different `TQueryFnData` generics. TS's tuple
// inference cannot express that shape, and unifying the 5 branches' distinct
// `UseTRPCQueryOptions<...>` instantiations into one array type fails on
// generic-parameter variance (observed: the `enabled` callback-option type
// conflicts across branches even though every value passed here is a plain
// boolean, never a function).
//
// At runtime each `t.<router>.<procedure>(input, opts)` call is simply
// `createUseQueries`'s proxy building a plain
// `{queryKey, queryFn, ...opts}` object (see
// `@trpc/react-query/src/shared/proxy/useQueriesProxy.ts`) — there is no
// runtime behavior tied to the tuple-typed generic, only a compile-time
// shape mismatch from an API designed for static call sites. The single
// `as` cast below (used only at this declaration, nowhere else in the file)
// narrows `api.useQueries` to the actual call signature this hook needs;
// this file's test suite proves the runtime contract holds.
// ---------------------------------------------------------------------------

interface QueryProcedureCall {
  (
    input: Record<string, unknown>,
    opts: { readonly enabled: boolean; readonly staleTime: number },
  ): { readonly queryKey: readonly unknown[] };
}

interface DataBindingsQueryProxy {
  readonly entities: {
    readonly byId: QueryProcedureCall;
    readonly list: QueryProcedureCall;
  };
  readonly emails: {
    readonly detail: QueryProcedureCall;
  };
  readonly knowledge: {
    readonly byId: QueryProcedureCall;
    readonly graph: QueryProcedureCall;
  };
}

interface DataBindingsQueryResult {
  readonly data: unknown;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

const useBindingQueries = api.useQueries as unknown as (
  callback: (t: DataBindingsQueryProxy) => readonly unknown[],
) => readonly DataBindingsQueryResult[];

// Wired procedures — exactly 5 of the 9 allowlisted (ALLOWED_PROCEDURES is
// NOT expanded this phase, D-23). A 6th wired case is a deliberate,
// reviewed-gate change per the synthesis — not a silent addition.
type WiredProcedure =
  | "entities.byId"
  | "entities.list"
  | "emails.detail"
  | "knowledge.byId"
  | "knowledge.graph";

/** Per-procedure staleTime tiers (ms) — BIND-02, first-pass values (33-CONTEXT.md). */
export const STALE_TIME_MS: Record<WiredProcedure, number> = {
  "knowledge.byId": 10_000,
  "knowledge.graph": 10_000,
  "entities.byId": 30_000,
  "entities.list": 30_000,
  "emails.detail": 60_000,
};

/** Single-tenant fallback (mirrors `knowledge-graph.tsx:130`'s own duplicate-
 * with-comment precedent — the canonical constant's import chain requires
 * server env vars and crashes client-side). */
const DEFAULT_IMPORTER_ID = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// extractBindings — pure helper: narrow top-level parse of `specJson`,
// scoped to just the `bindings` field (never the full SpecRoot — 33-CONTEXT.md
// "Getting spec.bindings without touching the locked files").
// ---------------------------------------------------------------------------

const BindingsRecordSchema = z.record(z.string(), DataBindingSchema).optional();

function parseJsonLenient(specJson: string): unknown | undefined {
  try {
    return JSON.parse(specJson);
  } catch {
    const repaired = attemptRepairJson(specJson);
    if (repaired === null) return undefined;
    try {
      return JSON.parse(repaired);
    } catch {
      return undefined;
    }
  }
}

/** Extracts and validates `specJson`'s top-level `bindings` field. Any
 * failure at any step (malformed JSON, unrepairable truncation, schema
 * validation) degrades to `{}` — never throws. */
export function extractBindings(specJson: string): Record<string, DataBinding> {
  const parsed = parseJsonLenient(specJson);
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) {
    return {};
  }

  const candidate = (parsed as Record<string, unknown>).bindings;
  if (candidate === undefined) return {};

  const result = BindingsRecordSchema.safeParse(candidate);
  if (!result.success || result.data === undefined) return {};

  return result.data;
}

// ---------------------------------------------------------------------------
// useDataBindings
// ---------------------------------------------------------------------------

export interface UseDataBindingsArgs {
  readonly specJson: string;
  readonly isStreaming: boolean;
  readonly panelData: Record<string, unknown>;
}

function readContextId(panelData: Record<string, unknown>, field: string): string | undefined {
  const value = panelData[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveEntitiesListInput(binding: DataBinding): Record<string, unknown> {
  const params = binding.params ?? {};
  // Explicit allowlisted-field pass-through (never a blind spread) — importerId
  // is deliberately excluded here even though DataBindingSchema's UUID refine
  // already blocks it (GR-15); this is the render-context-sourcing layer.
  const { search, sort, status, limit, offset, entityTypeId } = params as Record<
    string,
    string | number | boolean | undefined
  >;
  return { search, sort, status, limit, offset, entityTypeId };
}

function resolveKnowledgeGraphInput(
  binding: DataBinding,
  panelData: Record<string, unknown>,
): Record<string, unknown> {
  const params = binding.params ?? {};
  const { includeInstances, includeEmails, nodeTypes } = params as Record<
    string,
    string | number | boolean | undefined
  >;
  const importerId =
    typeof panelData.importerId === "string" ? panelData.importerId : DEFAULT_IMPORTER_ID;
  return { importerId, includeInstances, includeEmails, nodeTypes };
}

/**
 * Resolves `spec.bindings` into live tRPC query data. Returns a
 * `Record<bindingName, unknown>` where each value is the resolved query's
 * `data` (naturally `undefined` while loading/erroring, or when the binding
 * degrades — the "loading value inside the merged data" posture, 33-CONTEXT.md).
 */
export function useDataBindings(args: UseDataBindingsArgs): Record<string, unknown> {
  // `isStreaming` needs no separate branch: while streaming, `specJson` is a
  // truncated buffer whose `bindings` field either hasn't appeared yet or is
  // incomplete — `extractBindings`'s own try/catch + safeParse degrade both
  // to `{}` uniformly (33-CONTEXT.md "Streaming tolerance").
  const bindings = extractBindings(args.specJson);
  const entries = Object.entries(bindings);

  // api.useQueries is called unconditionally (even with an empty callback
  // result) — this hook calls exactly one hook total, so this is safe and
  // future-proof against a later second hook being added (rules-of-hooks).
  //
  // `flatMap` (0 or 1 element per entry) lets TypeScript infer the returned
  // array's element type as the natural union of the 5 wired `t.*(...)`
  // return types — no manual `unknown`-typed intermediate array needed. The
  // `merged` rebuild below iterates the SAME `entries` with the SAME
  // wired/unwired predicate, so result-array order stays in lockstep.
  const results = useBindingQueries((t) =>
    entries.flatMap(([, binding]) => {
      const procedure = binding.procedure as AllowedProcedure;

      switch (procedure) {
        case "entities.byId": {
          const id = readContextId(args.panelData, "selectedEntityId");
          return [
            t.entities.byId(
              { id: id ?? "" },
              { enabled: id !== undefined, staleTime: STALE_TIME_MS["entities.byId"] },
            ),
          ];
        }
        case "emails.detail": {
          const id = readContextId(args.panelData, "selectedEmailId");
          return [
            t.emails.detail(
              { id: id ?? "" },
              { enabled: id !== undefined, staleTime: STALE_TIME_MS["emails.detail"] },
            ),
          ];
        }
        case "knowledge.byId": {
          const id = readContextId(args.panelData, "selectedNodeId");
          return [
            t.knowledge.byId(
              { id: id ?? "" },
              { enabled: id !== undefined, staleTime: STALE_TIME_MS["knowledge.byId"] },
            ),
          ];
        }
        case "entities.list": {
          return [
            t.entities.list(resolveEntitiesListInput(binding), {
              enabled: true,
              staleTime: STALE_TIME_MS["entities.list"],
            }),
          ];
        }
        case "knowledge.graph": {
          return [
            t.knowledge.graph(resolveKnowledgeGraphInput(binding, args.panelData), {
              enabled: true,
              staleTime: STALE_TIME_MS["knowledge.graph"],
            }),
          ];
        }
        default: {
          // Deliberate boundary (33-CONTEXT.md): 4 of the 9 ALLOWED_PROCEDURES
          // entries (emails.list, emails.byId, entityTypes.list,
          // knowledge.list) are schema-valid but NOT wired this phase. A
          // future 6th wired case must be added here explicitly — never
          // silently dispatched.
          return [];
        }
      }
    }),
  );

  if (entries.length === 0) return {};

  // Rebuild key order from the SAME entries pass used above, mapping the
  // procedures that were actually pushed to `queries`. Procedures hitting the
  // `default` arm never produced a query entry, so their key maps to
  // `undefined` via the fallback below.
  const merged: Record<string, unknown> = {};
  let resultIndex = 0;
  const wiredKeys = new Set<WiredProcedure>([
    "entities.byId",
    "entities.list",
    "emails.detail",
    "knowledge.byId",
    "knowledge.graph",
  ]);

  for (const [key, binding] of entries) {
    if (wiredKeys.has(binding.procedure as WiredProcedure)) {
      merged[key] = results[resultIndex]?.data;
      resultIndex += 1;
    } else {
      merged[key] = undefined;
    }
  }

  return merged;
}
