/**
 * binding/risk-gate.ts — the risk-gating hook (INV-4).
 *
 * INV-4: risk is DATA, not code. No capability implements its own confirm flow; the ONE permission
 * model reads the capability's `risk` field and drives the prompt from it. genui does not own that
 * prompt — it MUST NOT render a dialog here. Its only job at bind time is to SURFACE the risk so a
 * consumer (a canvas panel, the chat runtime) can require a confirm before a non-read invocation.
 *
 * The rule is a pure predicate over the frozen `Risk` enum ("read" | "write" | "exec"):
 *   - `"read"`  → a query. No confirm required; a generated panel may run it on render.
 *   - `"write"` → a mutation. Confirm required (INV-4).
 *   - `"exec"`  → runs a process. Confirm required (INV-4).
 *
 * "non-read requires confirm" is expressed once, here, so every consumer gates identically. A consumer
 * that ignores this and mutates without confirming is the bug — the data told it not to.
 */

import type { Risk } from "@polytoken/capabilities";

/**
 * True when a capability of this risk must be confirmed before invocation (INV-4).
 * Read is the ONLY tier that may run without a confirm; every non-read tier gates.
 */
export const requiresConfirm = (risk: Risk): boolean => risk !== "read";
