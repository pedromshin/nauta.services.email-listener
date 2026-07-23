"use client";

/**
 * use-device-model-recommendation.ts — glue hook (DX Phase 0).
 *
 * Profiles the visitor's device once on mount (device-profile.ts) and computes
 * the recommended LOCAL model over the picker's own browser-locus registry rows
 * (model-recommendation.ts). Returns just the recommended registry id — the
 * ModelPicker badges that row "Recommended for your device". SUGGESTION ONLY:
 * this hook never mutates the selected model, never calls chat.setModel, never
 * downloads weights — it feeds a non-intrusive hint (Phase 0 plan §"Wire").
 *
 * Async profiling (WebGPU `requestAdapter`) runs in an effect; until it
 * resolves — and on SSR, or when the device is server-only — the hook returns
 * `null` and the picker shows no device badge.
 */

import { useEffect, useState } from "react";

import { profileDevice } from "~/lib/device-profile";
import {
  candidatesFromRegistry,
  recommendedModelId,
  recommendModel,
} from "~/lib/model-recommendation";

/**
 * @param browserModelIds registry ids whose execution_locus is "browser".
 *        Deriving the array in the caller (a stable-length list from a settled
 *        query) keeps this hook's dependency a plain joined key.
 * @returns the recommended browser model id, or null (still profiling /
 *          server-only / no browser models).
 */
export function useDeviceModelRecommendation(
  browserModelIds: readonly string[],
): string | null {
  const [recommendedId, setRecommendedId] = useState<string | null>(null);

  // Stable primitive dep — avoids re-running on a new-but-equal array identity.
  const idsKey = browserModelIds.join(",");

  useEffect(() => {
    if (browserModelIds.length === 0) {
      setRecommendedId(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const profile = await profileDevice();
      if (cancelled) return;
      const recommendation = recommendModel(
        profile,
        candidatesFromRegistry(browserModelIds),
      );
      setRecommendedId(recommendedModelId(recommendation));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return recommendedId;
}
