/**
 * panel-overlay.ts — the per-panel editable-overlay data model (PANL-01..04,
 * 52-01-PLAN.md Task 1).
 *
 * A panel's overlay is stored under `shared.panelOverlays.{panelId}` in the
 * canvas store (see canvas-store.ts — overlays MUST live under `shared` to
 * survive the seed-rehydration restore, since `toCanvasStoreSeed` only
 * restores the `panels`/`shared` keys). It records:
 *   - `activeVersionId` — which stored version (if any) is currently active;
 *     `null` means "no edits yet — render the base spec verbatim".
 *   - `stylePackId` — an OVERRIDE pack chosen independently of any version
 *     (the pack switcher, PANL-01); `null`/`undefined` means "defer to the
 *     active version's own pack, or the base spec's pack, or the default".
 *   - `versions` — the supersede-never-mutate version chain (PANL-03):
 *     regenerate/retheme/edit each APPEND a new version, never overwrite an
 *     existing one; prior versions stay reachable via `listPriorVersions`
 *     and restorable via `restoreVersion` (which itself appends a clone,
 *     never rewinds history).
 *
 * BUDGET BOUND (T-52-01-02, no migration tonight): `versions` is capped at
 * 50 entries and each version's `specJson` at 60,000 characters — chosen to
 * keep a panel's overlay comfortably inside the server's
 * MAX_SHARED_STATE_SERIALIZED_CHARS=100_000 budget for the WHOLE canvas's
 * `sharedState` blob (canvas-schema.ts). This is a documented bound, not
 * hard-enforced by the pure helpers below (an over-budget save fails
 * gracefully via the existing `buildSnapshot` try/catch in
 * use-canvas-persistence.ts, never crashing the canvas). A future dedicated
 * versions table would remove this bound entirely but requires a migration,
 * which is explicitly deferred (Docker/WSL down this session).
 *
 * All six helpers are pure and immutable (CLAUDE.md — spread only, never
 * mutate an input overlay/version in place).
 */

import { z } from "zod";

import { SpecRootSchema } from "@polytoken/genui/schema";
import { DEFAULT_PACK_ID, STYLE_PACK_IDS } from "@polytoken/genui/theme";
import type { StylePackId } from "@polytoken/genui/theme";

// ---------------------------------------------------------------------------
// PANEL_VERSION_VERBS — the closed set of provenance verbs a STORED version
// can carry. The base/original spec (before any edit) is never itself a
// stored PanelVersion — it lives only as the panel's own base spec content
// (rehydrated from chat_messages by provenance, D-05) — so it needs a
// separate sentinel (below) rather than a fourth enum member here.
// ---------------------------------------------------------------------------

export const PANEL_VERSION_VERBS = ["regenerate", "retheme", "edit"] as const;
export type PanelVersionVerb = (typeof PANEL_VERSION_VERBS)[number];

/**
 * INITIAL_VERSION_SENTINEL — a display-only tag (never a `PanelVersion.generatedBy`
 * value) that Plan 02/03's version-history UI uses to label the oldest row
 * "Generated" (52-UI-SPEC.md's provenance table) when that row is the base
 * spec itself, not a stored version. Exported here so every consumer shares
 * ONE sentinel string instead of each re-inventing its own.
 */
export const INITIAL_VERSION_SENTINEL = "initial" as const;

const STYLE_PACK_ID_TUPLE = STYLE_PACK_IDS as [StylePackId, ...StylePackId[]];

// ---------------------------------------------------------------------------
// PanelVersionSchema / PanelOverlaySchema
// ---------------------------------------------------------------------------

export const PanelVersionSchema = z
  .object({
    id: z.string().uuid(),
    generatedBy: z.enum(PANEL_VERSION_VERBS),
    parentVersionId: z.string().nullable(),
    createdAt: z.string().datetime(),
    // Stored serialized (not a parsed object) — keeps the sharedState deep
    // prototype-pollution guard from ever traversing spec content, and keeps
    // the size guard predictable (see module doc's BUDGET BOUND).
    specJson: z.string().max(60_000),
    stylePackId: z.enum(STYLE_PACK_ID_TUPLE).optional(),
    tokenOverrides: z.record(z.string(), z.string()).optional(),
    instruction: z.string().max(280).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type PanelVersion = z.infer<typeof PanelVersionSchema>;

export const PanelOverlaySchema = z
  .object({
    activeVersionId: z.string().nullable(),
    stylePackId: z.enum(STYLE_PACK_ID_TUPLE).nullable().optional(),
    versions: z.array(PanelVersionSchema).max(50),
  })
  .strict();

export type PanelOverlay = z.infer<typeof PanelOverlaySchema>;

/** The minimal valid overlay a mutator builds from when no overlay exists yet. */
const EMPTY_OVERLAY: PanelOverlay = { activeVersionId: null, versions: [] };

// ---------------------------------------------------------------------------
// ResolvedPanel — resolveActivePanel's pure output shape
// ---------------------------------------------------------------------------

export interface ResolvedPanel {
  readonly specJson: string;
  readonly packId: StylePackId;
  readonly tokenOverrides: Record<string, string>;
}

/**
 * isStylePackId — narrows an arbitrary string to the literal `StylePackId`
 * union. `SpecRootSchema`'s own `style_pack_id` field is validated at the
 * schema boundary via a SEPARATE `StylePackIdSchema` (packages/genui's
 * schema layer intentionally widens its z.infer to plain `string` so the
 * schema module never depends on the theme module's literal types) — this
 * re-narrows against the SAME `STYLE_PACK_IDS` source array the theme
 * module exports, so the two never drift.
 */
function isStylePackId(value: string): value is StylePackId {
  return (STYLE_PACK_IDS as readonly string[]).includes(value);
}

/**
 * readBaseSpecPackId — best-effort read of a base spec's OWN `style_pack_id`
 * (D-08/STYLE-04). Wraps JSON.parse in try/catch and safeParses against
 * SpecRootSchema — a malformed/foreign JSON string degrades to "no pack"
 * rather than throwing (T-23-09 posture, mirrored from every other
 * degrade-not-throw boundary in this canvas).
 */
function readBaseSpecPackId(baseSpecJson: string): StylePackId | undefined {
  try {
    const candidate: unknown = JSON.parse(baseSpecJson);
    const parsed = SpecRootSchema.safeParse(candidate);
    if (!parsed.success) return undefined;
    const { style_pack_id: packId } = parsed.data;
    return packId !== undefined && isStylePackId(packId) ? packId : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// resolveActivePanel — pure, deterministic resolution (the ONE read path
// every panel-rendering consumer uses)
// ---------------------------------------------------------------------------

/**
 * resolveActivePanel(overlay, baseSpecJson, baseIsStreaming) — resolves what
 * a panel should actually render right now:
 *   - while the base spec is STILL STREAMING, or when there is no active
 *     version yet (no overlay, or `activeVersionId` is null/unknown) — the
 *     base spec renders verbatim, themed by the overlay's pack OVERRIDE (if
 *     any) else the base spec's own pack else the default pack. Streaming
 *     always wins over an overlay (a stale edit must never race a live
 *     regenerate-in-progress stream).
 *   - once an active version exists and the base is settled — that
 *     version's spec renders, themed by the overlay's pack OVERRIDE (if any)
 *     else that version's OWN pack (captured at generation time) else the
 *     default pack; its own `tokenOverrides` apply.
 */
export function resolveActivePanel(
  overlay: PanelOverlay | undefined,
  baseSpecJson: string,
  baseIsStreaming: boolean,
): ResolvedPanel {
  const activeVersion =
    !baseIsStreaming && overlay?.activeVersionId
      ? overlay.versions.find((version) => version.id === overlay.activeVersionId)
      : undefined;

  if (baseIsStreaming || activeVersion === undefined) {
    return {
      specJson: baseSpecJson,
      packId: overlay?.stylePackId ?? readBaseSpecPackId(baseSpecJson) ?? DEFAULT_PACK_ID,
      tokenOverrides: {},
    };
  }

  return {
    specJson: activeVersion.specJson,
    packId: overlay?.stylePackId ?? activeVersion.stylePackId ?? DEFAULT_PACK_ID,
    tokenOverrides: { ...(activeVersion.tokenOverrides ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// setPack — pack-override write (PANL-01), never adds a version
// ---------------------------------------------------------------------------

/**
 * setPack(overlay, packId) — sets/overrides the overlay's `stylePackId`.
 * Creates a minimal overlay (`{ activeVersionId: null, versions: [] }`) when
 * none exists yet. Immutable — never mutates `overlay`. Does NOT append a
 * version (a pack switch alone is not a spec edit).
 */
export function setPack(overlay: PanelOverlay | undefined, packId: StylePackId): PanelOverlay {
  const base = overlay ?? EMPTY_OVERLAY;
  return { ...base, stylePackId: packId };
}

// ---------------------------------------------------------------------------
// appendVersion — supersede-never-mutate write (PANL-02/03/04)
// ---------------------------------------------------------------------------

export interface AppendVersionInput {
  readonly generatedBy: PanelVersionVerb;
  readonly specJson: string;
  readonly stylePackId?: StylePackId;
  readonly tokenOverrides?: Record<string, string>;
  readonly instruction?: string;
  readonly params?: Record<string, unknown>;
}

/**
 * appendVersion(overlay, input) — appends `input` as a brand-new version
 * (fresh uuid, `createdAt` stamped now, `parentVersionId` set to the PRIOR
 * `activeVersionId`), sets it active, and CLEARS the overlay's own
 * `stylePackId` override to `null` — the new version's own pack (if any)
 * takes over as the resolution source, so a stale pack override never
 * shadows freshly-generated content. Immutable — never mutates `overlay` or
 * `input`; always returns a brand-new overlay object.
 */
export function appendVersion(
  overlay: PanelOverlay | undefined,
  input: AppendVersionInput,
): PanelOverlay {
  const base = overlay ?? EMPTY_OVERLAY;

  const newVersion: PanelVersion = {
    id: crypto.randomUUID(),
    generatedBy: input.generatedBy,
    parentVersionId: base.activeVersionId,
    createdAt: new Date().toISOString(),
    specJson: input.specJson,
    ...(input.stylePackId !== undefined ? { stylePackId: input.stylePackId } : {}),
    ...(input.tokenOverrides !== undefined ? { tokenOverrides: { ...input.tokenOverrides } } : {}),
    ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
    ...(input.params !== undefined ? { params: { ...input.params } } : {}),
  };

  return {
    activeVersionId: newVersion.id,
    stylePackId: null,
    versions: [...base.versions, newVersion],
  };
}

// ---------------------------------------------------------------------------
// restoreVersion — supersede-never-mutate restore (PANL-03's History control)
// ---------------------------------------------------------------------------

/**
 * restoreVersion(overlay, versionId) — "restoring" an earlier version never
 * rewinds history: it APPENDS a brand-new version that clones the target
 * version's `specJson`/`stylePackId`/`tokenOverrides`/`instruction`/`params`
 * verbatim (`generatedBy` copied from the target, `parentVersionId` set to
 * the target's own id so the lineage stays traceable), sets it active, and
 * clears the overlay's pack override (mirrors `appendVersion`). If
 * `versionId` names no version in `overlay.versions` (a stale/unknown id),
 * this is a no-op that returns `overlay` UNCHANGED (never throws).
 */
export function restoreVersion(overlay: PanelOverlay, versionId: string): PanelOverlay {
  const target = overlay.versions.find((version) => version.id === versionId);
  if (target === undefined) return overlay;

  const cloned: PanelVersion = {
    id: crypto.randomUUID(),
    generatedBy: target.generatedBy,
    parentVersionId: target.id,
    createdAt: new Date().toISOString(),
    specJson: target.specJson,
    ...(target.stylePackId !== undefined ? { stylePackId: target.stylePackId } : {}),
    ...(target.tokenOverrides !== undefined ? { tokenOverrides: { ...target.tokenOverrides } } : {}),
    ...(target.instruction !== undefined ? { instruction: target.instruction } : {}),
    ...(target.params !== undefined ? { params: { ...target.params } } : {}),
  };

  return {
    activeVersionId: cloned.id,
    stylePackId: null,
    versions: [...overlay.versions, cloned],
  };
}

// ---------------------------------------------------------------------------
// listPriorVersions — the History popover's read path (PANL-03)
// ---------------------------------------------------------------------------

/**
 * listPriorVersions(overlay) — every stored version EXCEPT the current
 * active one, newest-first (by `createdAt`). Returns `[]` when `overlay` is
 * undefined or only the active version exists — the empty-state the History
 * popover renders as "No earlier versions yet — changes will appear here."
 */
export function listPriorVersions(overlay: PanelOverlay | undefined): PanelVersion[] {
  if (overlay === undefined) return [];
  return overlay.versions
    .filter((version) => version.id !== overlay.activeVersionId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ---------------------------------------------------------------------------
// parseOverlay — degrade-not-throw read boundary (T-52-01-01)
// ---------------------------------------------------------------------------

/**
 * parseOverlay(raw) — safeParses an arbitrary value (e.g. read from the
 * canvas store's `shared.panelOverlays.{panelId}` path) against
 * `PanelOverlaySchema`. A tampered/legacy/malformed record degrades to
 * `undefined` (never trusted, never thrown) — mirrors `validateSavedRow`'s
 * degrade posture in use-canvas-persistence.ts.
 */
export function parseOverlay(raw: unknown): PanelOverlay | undefined {
  const parsed = PanelOverlaySchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}
