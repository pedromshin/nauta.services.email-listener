/**
 * genui/retheme.ts — tRPC procedure: genui.resolveRetheme
 *
 * Proxies to FastAPI `POST /v1/genui/retheme` (Plan 52-05, PANL-04): a
 * one-shot natural-language instruction resolves, via ONE Bedrock
 * forced-tool-use call (no repair loop, no screenshot judging — locked), to
 * a { style_pack_id, token_overrides } envelope. Plan 52-06 wires the client
 * popover + applies the result as a `retheme` version — this plan produces
 * only the resolution.
 *
 * Security contracts (GEN-03/D-08, T-52-05-01/02, FOUND-6):
 *   - RethemeResolutionSchema is the AUTHORITATIVE web-boundary gate — LLM
 *     output is untrusted even after the Python-side belt (is_known_pack_id
 *     coercion + allowed-key filtering). safeParse re-validates:
 *       - style_pack_id must be a known STYLE_PACK_IDS member.
 *       - token_overrides keys are refined to ALLOWED_OVERRIDE_KEYS ONLY
 *         (TokenOverridesSchema is `.strict()` — an unlisted key fails
 *         validation rather than being silently stripped).
 *       - color-family values (primary/accent/secondary) MUST match the HSL
 *         channel-triplet regex; radius/spacing-density MUST match their own
 *         raw-value guards.
 *     A safeParse failure — regardless of what FastAPI's own `outcome` field
 *     claimed — returns a friendly `{ ok:false, reason }`, never the raw
 *     rejected payload (mirrors generate.ts's D-08 override behavior).
 *   - Non-2xx / network / JSON-parse failures return a friendly, detail-free
 *     `{ ok:false, reason }`; the raw error is logged server-side only
 *     (mirrors code-island.ts / generate.ts).
 *   - EMAIL_LISTENER_API_KEY is server-side only (getListenerConfig(); never
 *     NEXT_PUBLIC_).
 *   - protectedProcedure: requires a session (auth-gate only — mirrors
 *     generate.ts/code-island.ts; no per-user ownership scoping here, the
 *     resolution itself carries no persisted/tenant-scoped data).
 *   - Instruction capped at 280 chars at THIS boundary (T-52-05-04, DoS
 *     guard) — independent of and in addition to the FastAPI-side cap.
 */

import { z } from "zod";

import { STYLE_PACK_IDS } from "@polytoken/genui/theme";

import { protectedProcedure } from "../../trpc";
import { getListenerConfig } from "../_listener-config";

function logError(event: string, detail: unknown): void {
  process.stderr.write(
    JSON.stringify({
      procedure: "genui.resolveRetheme",
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
// ALLOWED_OVERRIDE_KEYS (T-52-05-02) — bounded, presentational CSS-var names.
// Mirrors app/domain/ports/retheme_resolver.py's ALLOWED_OVERRIDE_KEYS
// verbatim (kept in sync by review — same Python/TS parity convention as
// STYLE_PACK_IDS). PanelThemeScope (Plan 52-01) applies each as an inline
// `--{key}` custom property; nothing outside this set may ever reach a
// rendered panel.
// ---------------------------------------------------------------------------

export const ALLOWED_OVERRIDE_KEYS = [
  "primary",
  "accent",
  "secondary",
  "radius",
  "spacing-density",
] as const;

// ---------------------------------------------------------------------------
// Value-format guards (T-52-05-02) — the exact HSL-channel-triplet regex is
// specified verbatim by 52-05-PLAN.md's interfaces section.
// ---------------------------------------------------------------------------

const HSL_TRIPLET_REGEX = /^\d{1,3} \d{1,3}% \d{1,3}%$/;
const RADIUS_VALUE_REGEX = /^\d+(\.\d+)?(rem|px)$/;
const SPACING_DENSITY_VALUE_REGEX = /^\d+(\.\d+)?rem$/;

/**
 * TokenOverridesSchema — `.strict()` so a key outside ALLOWED_OVERRIDE_KEYS
 * fails validation (rather than being silently stripped), and each present
 * key's value must match its own format guard. All keys optional — an empty
 * object (pack swap only, no nudges) is valid.
 */
const TokenOverridesSchema = z
  .object({
    primary: z.string().regex(HSL_TRIPLET_REGEX).optional(),
    accent: z.string().regex(HSL_TRIPLET_REGEX).optional(),
    secondary: z.string().regex(HSL_TRIPLET_REGEX).optional(),
    radius: z.string().regex(RADIUS_VALUE_REGEX).optional(),
    "spacing-density": z.string().regex(SPACING_DENSITY_VALUE_REGEX).optional(),
  })
  .strict();

/**
 * RethemeResolutionSchema — the AUTHORITATIVE web-boundary gate (GEN-03/D-08).
 * Deliberately NOT `.strict()` at the top level: the FastAPI envelope also
 * carries an `outcome` field (informational, server-computed) that this
 * schema intentionally ignores rather than rejecting the whole payload over.
 */
export const RethemeResolutionSchema = z.object({
  style_pack_id: z.enum(STYLE_PACK_IDS as [string, ...string[]]),
  token_overrides: TokenOverridesSchema,
});

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const RethemeInput = z.object({
  /** Free-text NL instruction describing the desired look. */
  instruction: z.string().min(1).max(280),
  /** The panel's current active pack id — resolver context + fallback target. */
  currentStylePackId: z.enum(STYLE_PACK_IDS as [string, ...string[]]).optional(),
});

// ---------------------------------------------------------------------------
// Output schema — flat { ok, stylePackId?, tokenOverrides?, reason? } shape,
// mirroring generate.ts's flat outcome/spec/reason convention.
// ---------------------------------------------------------------------------

const RethemeOutputSchema = z.object({
  ok: z.boolean(),
  stylePackId: z.enum(STYLE_PACK_IDS as [string, ...string[]]).optional(),
  tokenOverrides: z.record(z.string()).optional(),
  /** Friendly, non-leaking reason — present only when ok=false. */
  reason: z.string().optional(),
});

export type RethemeOutput = z.infer<typeof RethemeOutputSchema>;

/** Drop undefined-valued entries from a partial override map (immutable — new object). */
function toTokenOverridesRecord(
  overrides: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(overrides).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function fallback(reason: string): RethemeOutput {
  return { ok: false, reason };
}

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export const resolveRethemeProcedure = protectedProcedure
  .input(RethemeInput)
  .output(RethemeOutputSchema)
  .query(async ({ input }): Promise<RethemeOutput> => {
    const { url, apiKey } = getListenerConfig();

    let res: Response;
    try {
      res = await fetch(`${url}/v1/genui/retheme`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          instruction: input.instruction,
          current_style_pack_id: input.currentStylePackId ?? null,
        }),
      });
    } catch (networkErr) {
      logError("retheme_network_error", networkErr);
      return fallback("The re-theme service is temporarily unavailable.");
    }

    if (!res.ok) {
      let rawDetail: unknown = "(unreadable)";
      try {
        rawDetail = await res.json();
      } catch {
        // ignore parse failure
      }
      logError("retheme_non2xx", `status=${res.status} detail=${JSON.stringify(rawDetail)}`);
      return fallback("Couldn't apply that look — try describing it differently.");
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (parseErr) {
      logError("retheme_json_parse_error", parseErr);
      return fallback("Received an unreadable response from the re-theme service.");
    }

    const dataField =
      body !== null &&
      typeof body === "object" &&
      "data" in body &&
      (body as Record<string, unknown>)["data"] !== null &&
      typeof (body as Record<string, unknown>)["data"] === "object"
        ? ((body as Record<string, unknown>)["data"] as Record<string, unknown>)
        : undefined;

    if (dataField === undefined) {
      logError("retheme_missing_data_field", JSON.stringify(body));
      return fallback("Received an unexpected response structure from the re-theme service.");
    }

    // GEN-03/D-08: re-validate at the web boundary — NEVER trust FastAPI output blindly.
    // Authoritative regardless of what FastAPI's own `outcome` field claims.
    const parsed = RethemeResolutionSchema.safeParse(dataField);
    if (!parsed.success) {
      logError("retheme_revalidation_failed", JSON.stringify(parsed.error.issues));
      return fallback("Couldn't apply that look — try describing it differently.");
    }

    return {
      ok: true,
      stylePackId: parsed.data.style_pack_id,
      tokenOverrides: toTokenOverridesRecord(parsed.data.token_overrides),
    };
  });
