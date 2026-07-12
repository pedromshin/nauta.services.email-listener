/**
 * genui/panel-edit.ts — tRPC procedure: genui.applyPanelEdit
 *
 * Security contracts (PANL-02, 52-03-PLAN.md Task 2):
 *   FOUND-6 / GEN-03 / D-08: The web layer NEVER trusts client-supplied spec
 *     content blindly. `currentSpecJson` is parsed and re-validated with
 *     SpecRootSchema.safeParse BEFORE any param is applied; the whitelisted
 *     params (PanelEditParamsSchema, panel-edit-schema.ts) are applied via
 *     the pure `applyWhitelistedParams`, whose own result is ALSO
 *     re-validated with SpecRootSchema.safeParse before ever being returned.
 *     Two independent gates, matching applyWhitelistedParams's own defense-
 *     in-depth posture.
 *
 *   T-52-03-04 (Information Disclosure): a malformed currentSpecJson, an
 *     invalid base spec, or a patch that fails re-validation ALL return the
 *     SAME friendly, detail-free reason. The raw JSON.parse error / Zod
 *     issues are logged server-side only via `logError` (mirrors
 *     generate.ts's structured-logger idiom) — never echoed to the caller.
 *
 *   This procedure is DB-free / no FastAPI call — it operates only on the
 *   client-supplied spec, which it fully re-validates itself. No ownership
 *   scoping is needed (mirrors generate.ts/retheme.ts's auth-gate-only
 *   posture for procedures that carry no persisted/tenant-scoped data).
 *
 *   `protectedProcedure`: requires a session (auth-gate only, matches
 *   generate.ts).
 *
 *   Defined as a `.mutation()` (not `.query()`, unlike generate.ts/
 *   retheme.ts's read-shaped FastAPI proxies) — edit-params-control.tsx
 *   (Task 3) calls it via `api.genui.applyPanelEdit.useMutation()`, matching
 *   its own state-changing intent (the result feeds a NEW overlay version).
 */

import { z } from "zod";

import { SpecRootSchema } from "@polytoken/genui/schema";

import { protectedProcedure } from "../../trpc";
import { applyWhitelistedParams, PanelEditParamsSchema } from "./panel-edit-schema";

function logError(event: string, detail: unknown): void {
  process.stderr.write(
    JSON.stringify({
      procedure: "genui.applyPanelEdit",
      event,
      detail:
        detail instanceof Error
          ? { message: detail.message, name: detail.name }
          : String(detail),
      ts: new Date().toISOString(),
    }) + "\n",
  );
}

// ---------------------------------------------------------------------------
// Input / output schemas
// ---------------------------------------------------------------------------

const ApplyPanelEditInput = z.object({
  /** The panel's current active spec, serialized — re-parsed + re-validated here. */
  currentSpecJson: z.string().max(60_000),
  /** Bounded, whitelisted param patch — see panel-edit-schema.ts (Task 1). */
  params: PanelEditParamsSchema,
});

const ApplyPanelEditOutputSchema = z.object({
  ok: z.boolean(),
  /** Validated SpecRoot JSON — present only when ok=true. */
  spec: SpecRootSchema.optional(),
  /** Friendly, non-leaking reason — present only when ok=false. */
  reason: z.string().optional(),
});

export type ApplyPanelEditOutput = z.infer<typeof ApplyPanelEditOutputSchema>;

const REJECTED_REASON = "Those changes couldn't be applied to this panel.";

function fallback(reason: string): ApplyPanelEditOutput {
  return { ok: false, reason };
}

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export const applyPanelEditProcedure = protectedProcedure
  .input(ApplyPanelEditInput)
  .output(ApplyPanelEditOutputSchema)
  .mutation(({ input }): ApplyPanelEditOutput => {
    let rawSpec: unknown;
    try {
      rawSpec = JSON.parse(input.currentSpecJson);
    } catch (parseErr) {
      logError("panel_edit_json_parse_error", parseErr);
      return fallback(REJECTED_REASON);
    }

    // FOUND-6: re-validate the client-supplied base spec before touching it.
    const parsedBase = SpecRootSchema.safeParse(rawSpec);
    if (!parsedBase.success) {
      logError("panel_edit_base_revalidation_failed", JSON.stringify(parsedBase.error.issues));
      return fallback(REJECTED_REASON);
    }

    const applied = applyWhitelistedParams(parsedBase.data, input.params);
    if (!applied.ok) {
      logError("panel_edit_apply_failed", applied.error);
      return fallback(REJECTED_REASON);
    }

    return { ok: true, spec: applied.spec };
  });
