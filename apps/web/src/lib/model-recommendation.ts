/**
 * model-recommendation.ts — pure local-model recommender (DX Phase 0).
 *
 * Given a `DeviceProfile` (device-profile.ts) and a set of candidate LOCAL
 * (browser-locus) models, pick the largest model the device can actually run
 * in-browser, or fall back to `server-only` when it can't run any. This is a
 * SUGGESTION surface only — it never switches the user's model, it only tells
 * the picker which row to badge "Recommended for your device"
 * (.planning/research/2026-07-23-distributed-inference-phase-plan.md Phase 0).
 *
 * Everything here is pure and deterministic: same profile + candidates → same
 * recommendation, so the truth table is unit-testable across device classes
 * without a browser.
 *
 * Heuristic (deliberately coarse, documented, and honest — 2026 browser-tier
 * guidance caps practical models ≈8B, sweet-spot 0.5–3B Q4; E7 research §6.1):
 *   1. No granted WebGPU adapter        → server-only.
 *   2. Estimate a VRAM budget (MB) from device memory, capped by the WebGPU
 *      single-buffer limit (a discrete GPU reports a far larger cap than an
 *      integrated one, which is how we separate the top tier given Chromium
 *      clamps `deviceMemory` to 8).
 *   3. Keep candidates whose required VRAM ≤ budget AND params ≤ the browser
 *      cap; pick the largest by params (tie-break: smallest required VRAM).
 *   4. Nothing fits → server-only.
 */

import type { DeviceProfile } from "./device-profile";

// ---------------------------------------------------------------------------
// Candidate model shape + the shipped catalogue.
// ---------------------------------------------------------------------------

export interface LocalModelCandidate {
  /** The chat registry id (execution_locus === "browser"), e.g. the shipped
   * `webllm-qwen3-4b`. */
  readonly id: string;
  /** Total VRAM the WebLLM prebuild needs to load + run (MB) — from
   * `prebuiltAppConfig`'s `vram_required_MB`. */
  readonly requiredVramMb: number;
  /** Approximate parameter count (billions) — used to order "largest fits". */
  readonly approxParamsB: number;
}

/**
 * The shipped browser-locus catalogue. Only the ONE model the WebLLM engine
 * actually loads today (`Qwen3-4B-q4f16_1-MLC`, registry id
 * `webllm-qwen3-4b`); `vram_required_MB` is that prebuild's own figure. Honest
 * by construction — we never recommend a local model that isn't downloadable
 * (D-05/D-06 honesty contract). Add rows here as new browser prebuilds are
 * vetted into the registry.
 */
export const SHIPPED_LOCAL_MODEL_CANDIDATES: readonly LocalModelCandidate[] = [
  { id: "webllm-qwen3-4b", requiredVramMb: 3431, approxParamsB: 4 },
];

/**
 * Requirement lookup for mapping arbitrary registry browser models → candidates
 * (see `candidatesFromRegistry`). Keyed by registry id. Unknown ids fall back to
 * a conservative requirement so an unrecognised model is never over-recommended.
 */
const WEBLLM_MODEL_REQUIREMENTS: Readonly<
  Record<string, Omit<LocalModelCandidate, "id">>
> = {
  "webllm-qwen3-4b": { requiredVramMb: 3431, approxParamsB: 4 },
};

const CONSERVATIVE_UNKNOWN_REQUIREMENT: Omit<LocalModelCandidate, "id"> = {
  // Assume ~8B / 4.5GB for an unknown browser model — the top of the browser
  // tier — so it only gets recommended on clearly capable devices.
  requiredVramMb: 4608,
  approxParamsB: 8,
};

// ---------------------------------------------------------------------------
// Tuning constants (documented so the heuristic is auditable, not magic).
// ---------------------------------------------------------------------------

/** Fraction of reported RAM usable for model weights (OS + browser + tab
 * overhead eats the rest). Conservative on purpose. */
const USABLE_MEM_FRACTION = 0.55;
/** A model's total size ≈ this × its largest single weight buffer, so a device
 * whose `maxBufferSize` is B can host a model up to ~B × this. Gates out only
 * genuinely tiny-buffer adapters (integrated GPUs report ≥2GB in 2026). */
const MODEL_TO_MAX_BUFFER_RATIO = 4;
/** Budget used when RAM is unknown (Safari/Firefox) — enough for a small model
 * only, so we don't over-recommend on a device we can't measure. */
const DEFAULT_BUDGET_WHEN_MEM_UNKNOWN_MB = 2048;
/** 2026 practical browser inference cap (E7 research §1.A / §6.1). */
const BROWSER_PARAM_CAP_B = 8;
const MB_PER_GB = 1024;
const BYTES_PER_MB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

export type ModelRecommendation =
  | {
      readonly kind: "local";
      readonly modelId: string;
      /** Human-readable "why", surfaced in the picker hint. */
      readonly reason: string;
      /** The budget the decision used (MB) — exposed for debugging/telemetry. */
      readonly estimatedVramBudgetMb: number;
    }
  | {
      readonly kind: "server-only";
      readonly reason: string;
      readonly estimatedVramBudgetMb: number;
    };

/**
 * Estimate an in-browser VRAM budget (MB) from a device profile. Memory-driven,
 * capped by the WebGPU single-buffer limit. Exported for testing/telemetry.
 */
export function estimateVramBudgetMb(profile: DeviceProfile): number {
  const memBudgetMb =
    profile.deviceMemoryGb !== undefined
      ? profile.deviceMemoryGb * MB_PER_GB * USABLE_MEM_FRACTION
      : DEFAULT_BUDGET_WHEN_MEM_UNKNOWN_MB;

  const gpuCapMb =
    profile.webgpu.maxBufferSizeBytes !== undefined
      ? (profile.webgpu.maxBufferSizeBytes / BYTES_PER_MB) *
        MODEL_TO_MAX_BUFFER_RATIO
      : Number.POSITIVE_INFINITY;

  return Math.min(memBudgetMb, gpuCapMb);
}

/**
 * Recommend the optimal LOCAL model for this device, or `server-only`.
 * Pure — no side effects, no I/O.
 *
 * @param profile     Captured device profile.
 * @param candidates  Browser-locus models to choose among (defaults to the
 *                    shipped catalogue).
 */
export function recommendModel(
  profile: DeviceProfile,
  candidates: readonly LocalModelCandidate[] = SHIPPED_LOCAL_MODEL_CANDIDATES,
): ModelRecommendation {
  const budgetMb = estimateVramBudgetMb(profile);

  if (!profile.webllmSupported) {
    return {
      kind: "server-only",
      reason: profile.webgpu.available
        ? "Your browser exposes WebGPU but couldn't grant a graphics adapter, so local models can't run here — using server models."
        : "Your browser doesn't support WebGPU, so local models can't run here — using server models.",
      estimatedVramBudgetMb: budgetMb,
    };
  }

  const fitting = candidates.filter(
    (candidate) =>
      candidate.requiredVramMb <= budgetMb &&
      candidate.approxParamsB <= BROWSER_PARAM_CAP_B,
  );

  if (fitting.length === 0) {
    return {
      kind: "server-only",
      reason:
        "This device's GPU and memory are too limited to run a local model well — using server models.",
      estimatedVramBudgetMb: budgetMb,
    };
  }

  // Largest by params; tie-break toward the lighter (smaller required VRAM) build.
  const best = fitting.reduce((chosen, candidate) => {
    if (candidate.approxParamsB > chosen.approxParamsB) return candidate;
    if (
      candidate.approxParamsB === chosen.approxParamsB &&
      candidate.requiredVramMb < chosen.requiredVramMb
    ) {
      return candidate;
    }
    return chosen;
  });

  return {
    kind: "local",
    modelId: best.id,
    reason: `Your device can run this ~${best.approxParamsB}B model locally — private and free, no server round-trip.`,
    estimatedVramBudgetMb: budgetMb,
  };
}

/**
 * Map registry browser-locus models → candidates via the requirement lookup, so
 * the recommender chooses among the models the picker actually offers. Non
 * browser-locus models are ignored by the caller before this point.
 */
export function candidatesFromRegistry(
  browserModelIds: readonly string[],
): LocalModelCandidate[] {
  return browserModelIds.map((id) => ({
    id,
    ...(WEBLLM_MODEL_REQUIREMENTS[id] ?? CONSERVATIVE_UNKNOWN_REQUIREMENT),
  }));
}

/**
 * Convenience: the recommended model id, or `null` when server-only / no
 * candidates. The exact value the picker needs to badge a row.
 */
export function recommendedModelId(
  recommendation: ModelRecommendation,
): string | null {
  return recommendation.kind === "local" ? recommendation.modelId : null;
}
