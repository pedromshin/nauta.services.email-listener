/**
 * genui/generate.ts — tRPC procedure: genui.generate
 *
 * Security contracts:
 *   GEN-03 / D-08: The web layer NEVER trusts FastAPI output blindly.
 *     SpecRootSchema.safeParse() re-validates the returned spec at this
 *     web boundary. On any validation failure, SAFE_FALLBACK_SPEC is
 *     returned and the error is logged server-side. The raw invalid spec
 *     is never returned to the caller.
 *
 *   T-13-19: Non-2xx responses from FastAPI return SAFE_FALLBACK_SPEC
 *     with a friendly, detail-free message. The raw error body from
 *     FastAPI (which may contain internal debug info) is logged
 *     server-side only — never surfaced to the caller.
 *
 *   T-06-07 / T-07-01: EMAIL_LISTENER_API_KEY is server-side only.
 *     Read via getListenerConfig() at call time — never module-init,
 *     never NEXT_PUBLIC_. (D-23)
 *
 *   GEN-04: Non-streaming — buffer the full FastAPI response, run
 *     safeParse on the complete spec, then return. No streaming.
 */

import { SAFE_FALLBACK_SPEC, SpecRootSchema } from "@nauta/genui/schema";
import { z } from "zod";

import { publicProcedure } from "../../trpc";
import { getListenerConfig } from "../_listener-config";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GenerateInput = z.object({
  /** Free-text prompt that describes the user's intent for the UI view. */
  intent: z.string().min(1).max(4096),
});

// ---------------------------------------------------------------------------
// Output schema — union of ok / fallback shapes
// ---------------------------------------------------------------------------

const GenerateOutputSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("ok"),
    spec: SpecRootSchema,
  }),
  z.object({
    outcome: z.literal("fallback"),
    spec: SpecRootSchema,
    /** Friendly, non-leaking reason shown to the caller. */
    reason: z.string(),
  }),
]);

export type GenerateOutput = z.infer<typeof GenerateOutputSchema>;

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

export const generateProcedure = publicProcedure
  .input(GenerateInput)
  .output(GenerateOutputSchema)
  .query(async ({ input }) => {
    const { url, apiKey } = getListenerConfig();

    // GEN-04: Proxy to FastAPI (non-streaming — buffer full response)
    let res: Response;
    try {
      res = await fetch(`${url}/v1/genui/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ intent: input.intent }),
      });
    } catch (networkErr) {
      // Network failure — return fallback (T-13-19: no leaked detail)
      console.error("[genui.generate] network error calling FastAPI", networkErr);
      return {
        outcome: "fallback" as const,
        spec: SAFE_FALLBACK_SPEC,
        reason: "The generation service is temporarily unavailable.",
      };
    }

    // T-13-19: Non-2xx response → log server-side, return friendly fallback
    if (!res.ok) {
      let rawDetail: unknown = "(unreadable)";
      try {
        rawDetail = await res.json();
      } catch {
        // ignore parse failure
      }
      console.error(
        `[genui.generate] FastAPI returned ${res.status}:`,
        rawDetail,
      );
      return {
        outcome: "fallback" as const,
        spec: SAFE_FALLBACK_SPEC,
        reason: "Could not generate a view for this request. Please try again.",
      };
    }

    // Buffer and parse the FastAPI response body
    let body: unknown;
    try {
      body = await res.json();
    } catch (parseErr) {
      console.error("[genui.generate] failed to parse FastAPI JSON response", parseErr);
      return {
        outcome: "fallback" as const,
        spec: SAFE_FALLBACK_SPEC,
        reason: "Received an unreadable response from the generation service.",
      };
    }

    // Extract the spec field from the FastAPI response envelope
    const rawSpec =
      body !== null &&
      typeof body === "object" &&
      "spec" in body
        ? (body as Record<string, unknown>)["spec"]
        : body;

    // D-08: Re-validate at web boundary — NEVER trust model output blindly
    const parsed = SpecRootSchema.safeParse(rawSpec);

    if (!parsed.success) {
      // Log the full validation error server-side (not to caller)
      console.error(
        "[genui.generate] SpecRootSchema re-validation FAILED (D-08):",
        JSON.stringify(parsed.error.issues),
      );
      return {
        outcome: "fallback" as const,
        spec: SAFE_FALLBACK_SPEC,
        reason: "The generated view could not be verified. Showing a safe fallback.",
      };
    }

    // Spec passed re-validation — safe to return
    return {
      outcome: "ok" as const,
      spec: parsed.data,
    };
  });
