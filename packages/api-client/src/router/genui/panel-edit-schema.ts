/**
 * panel-edit-schema.ts — PANL-02's authoritative, DB-free spec-parameter
 * whitelist + pure application function (52-03-PLAN.md Task 1).
 *
 * Zero imports beyond `zod` + `@polytoken/genui/schema` — deliberately
 * DB-free so both the `genui.applyPanelEdit` tRPC procedure (panel-edit.ts,
 * server) AND the Parameter Editor Popover (edit-params-control.tsx, client
 * — via `@polytoken/api-client`'s `./genui/panel-edit-schema` export
 * subpath) import the SAME whitelist. There is only ever ONE source of
 * truth for "which spec parameters are editable and how they're bounded" —
 * the client mirrors it for fast inline feedback, the server re-validates
 * it authoritatively (FOUND-6 / the same untrusted-input boundary pattern
 * generate.ts already established).
 *
 * Security contracts:
 *   T-52-03-01 (Tampering): PanelEditParamsSchema is `.strict()` — only the
 *     whitelisted keys, each individually bounded (string max-length, enum
 *     closed-set, number min/max), are ever accepted. No free-form JSON
 *     control exists anywhere in this module or its consumers.
 *   T-52-03-02 (Elevation of Privilege): applyWhitelistedParams only ever
 *     patches scalar attrs onto `root` (never `children`/`header`/`footer`/
 *     `type` — those keys are structurally impossible to include, because
 *     PANEL_EDIT_FIELDS never lists them) and ALWAYS re-validates the
 *     patched result via SpecRootSchema.safeParse before returning `ok:true`
 *     — regardless of whether `params` already passed some upstream schema.
 *   T-52-03-03 (Tampering — prototype pollution): every schema here is
 *     `.strict()`; `__proto__`/`constructor`/`prototype` are never valid
 *     keys of PanelEditParamsSchema, so they can never survive
 *     `PanelEditParamsSchema.safeParse` at the tRPC input boundary. Inside
 *     applyWhitelistedParams itself, `Object.entries(params)` only ever
 *     iterates OWN enumerable string keys of an already-.strict()-parsed
 *     object (or, for direct/defensive callers, is filtered through
 *     `allowedKeys` before ever reaching `patch`) — a `__proto__` entry
 *     from `Object.entries` assigns onto `patch` as a plain data property,
 *     never onto the prototype chain, so no pollution path exists even for
 *     an adversarially-constructed plain object.
 */

import { z } from "zod";

import { SpecRootSchema } from "@polytoken/genui/schema";
import type { SpecRoot } from "@polytoken/genui/schema";

// ---------------------------------------------------------------------------
// GAP / DIRECTION — mirror packages/genui/src/schema/spec-schema.ts's
// SectionNodeSchema/StackNodeSchema/GridNodeSchema `gap` enum and
// StackNodeSchema's `direction` enum verbatim (kept in sync by review — same
// convention already used for ALLOWED_OVERRIDE_KEYS/STYLE_PACK_IDS parity in
// retheme.ts).
// ---------------------------------------------------------------------------

export const GAP = ["none", "sm", "md", "lg"] as const;
export type Gap = (typeof GAP)[number];

export const DIRECTION = ["vertical", "horizontal"] as const;
export type Direction = (typeof DIRECTION)[number];

// ---------------------------------------------------------------------------
// PanelEditFieldDescriptor — the shape edit-params-control.tsx (52-03-PLAN.md
// Task 3) introspects to pick a control (string -> Input, text -> Textarea,
// enum -> Select, number -> Input type=number) and render bound-derived
// helper text ("{n} characters max" / "Range: {min}-{max}") per
// 52-UI-SPEC.md's field-type -> control mapping table.
// ---------------------------------------------------------------------------

export type PanelEditFieldKey = "title" | "description" | "heading" | "gap" | "direction" | "cols";
export type PanelEditFieldKind = "string" | "text" | "enum" | "number";

export interface PanelEditFieldDescriptor {
  readonly key: PanelEditFieldKey;
  readonly kind: PanelEditFieldKind;
  readonly max?: number;
  readonly min?: number;
  readonly options?: readonly string[];
}

// ---------------------------------------------------------------------------
// PANEL_EDIT_FIELDS — root-type -> editable field descriptors. Any root type
// not listed here has NO editable parameters — editableFieldsFor returns []
// — the empty-whitelist case the toolbar's SlidersHorizontal button disables
// for ("This panel has no editable parameters", 52-UI-SPEC.md).
// ---------------------------------------------------------------------------

export const PANEL_EDIT_FIELDS: Readonly<Record<string, readonly PanelEditFieldDescriptor[]>> = {
  card: [
    { key: "title", kind: "string", max: 120 },
    { key: "description", kind: "text", max: 300 },
  ],
  section: [
    { key: "heading", kind: "string", max: 120 },
    { key: "gap", kind: "enum", options: GAP },
  ],
  stack: [
    { key: "direction", kind: "enum", options: DIRECTION },
    { key: "gap", kind: "enum", options: GAP },
  ],
  grid: [
    { key: "cols", kind: "number", min: 1, max: 12 },
    { key: "gap", kind: "enum", options: GAP },
  ],
};

/** editableFieldsFor(rootType) — PANEL_EDIT_FIELDS[rootType] ?? [] (any other root type has no editable params). */
export function editableFieldsFor(rootType: string): readonly PanelEditFieldDescriptor[] {
  return PANEL_EDIT_FIELDS[rootType] ?? [];
}

// ---------------------------------------------------------------------------
// PanelEditParamsSchema — the union of every whitelisted key across every
// root type, each bounded per its descriptor above. `.strict()` — an
// unknown key is rejected outright at the tRPC input boundary (T-52-03-01),
// never silently dropped. This schema does NOT know the caller's root
// type — a key valid for one root type but not another (e.g. `cols` on a
// card) passes HERE and is instead ignored by applyWhitelistedParams below
// (never applied, never erred — see that function's own doc).
// ---------------------------------------------------------------------------

export const PanelEditParamsSchema = z
  .object({
    title: z.string().max(120).optional(),
    description: z.string().max(300).optional(),
    heading: z.string().max(120).optional(),
    gap: z.enum(GAP).optional(),
    direction: z.enum(DIRECTION).optional(),
    cols: z.number().int().min(1).max(12).optional(),
  })
  .strict();

export type PanelEditParams = z.infer<typeof PanelEditParamsSchema>;

// ---------------------------------------------------------------------------
// applyWhitelistedParams — pure, DB-free, immutable spec-param application +
// re-validation (T-52-03-02).
// ---------------------------------------------------------------------------

export type ApplyWhitelistedParamsResult =
  | { readonly ok: true; readonly spec: SpecRoot }
  | { readonly ok: false; readonly error: string };

/**
 * applyWhitelistedParams(baseSpec, params) — returns `baseSpec` with ONLY
 * the params whitelisted for `baseSpec.root`'s type applied immutably onto
 * root (spread only — `baseSpec`/`params` are NEVER mutated), then
 * re-validates the result with `SpecRootSchema.safeParse`. Params not valid
 * for the root type are silently ignored (never written, never erred) — a
 * `cols` value sent for a `card` root simply never reaches the patch. A
 * post-apply spec that fails re-validation returns `{ ok:false }` — the
 * caller (panel-edit.ts's tRPC procedure) NEVER returns a spec that failed
 * this re-check (the FOUND-6 gate, applied to the panel-edit surface).
 */
export function applyWhitelistedParams(
  baseSpec: SpecRoot,
  params: PanelEditParams,
): ApplyWhitelistedParamsResult {
  const fields = editableFieldsFor(baseSpec.root.type);
  const allowedKeys = new Set<string>(fields.map((field) => field.key));

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (allowedKeys.has(key)) {
      patch[key] = value;
    }
  }

  const rootRecord = baseSpec.root as Record<string, unknown>;
  const patchedRoot = { ...rootRecord, ...patch };
  const candidate = { ...baseSpec, root: patchedRoot };

  const parsed = SpecRootSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: "Applying these parameters produced an invalid spec." };
  }
  return { ok: true, spec: parsed.data };
}
