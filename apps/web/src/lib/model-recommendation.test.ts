/**
 * model-recommendation.test.ts — recommendModel() truth table across device
 * classes + the pure helpers (estimateVramBudgetMb, candidatesFromRegistry,
 * recommendedModelId). No browser: DeviceProfile is a plain literal.
 */

import { describe, expect, it } from "vitest";

import type { DeviceProfile } from "./device-profile";
import {
  candidatesFromRegistry,
  estimateVramBudgetMb,
  recommendModel,
  recommendedModelId,
  SHIPPED_LOCAL_MODEL_CANDIDATES,
  type LocalModelCandidate,
} from "./model-recommendation";

const GB = 1024 * 1024 * 1024;

/** Multi-size synthetic catalogue so "largest that fits" is observable. */
const CATALOGUE: readonly LocalModelCandidate[] = [
  { id: "tiny-1b", requiredVramMb: 900, approxParamsB: 1 },
  { id: "mid-4b", requiredVramMb: 3431, approxParamsB: 4 },
  { id: "large-8b", requiredVramMb: 4608, approxParamsB: 8 },
  { id: "huge-13b", requiredVramMb: 8000, approxParamsB: 13 },
];

function profile(overrides: Partial<DeviceProfile>): DeviceProfile {
  const { webgpu, ...rest } = overrides;
  return {
    webllmSupported: true,
    ...rest,
    webgpu: { available: true, adapterGranted: true, ...webgpu },
  };
}

describe("recommendModel — device-class truth table", () => {
  it("high-end GPU + high memory → largest browser-cap model (8B)", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 32,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 4 * GB,
        },
      }),
      CATALOGUE,
    );
    expect(rec.kind).toBe("local");
    expect(rec.kind === "local" && rec.modelId).toBe("large-8b");
  });

  it("13B never recommended even when VRAM fits — browser 8B param cap", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 64,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 8 * GB,
        },
      }),
      CATALOGUE,
    );
    // Budget easily covers huge-13b's 8000MB, but the 13B > 8B cap excludes it.
    expect(rec.kind === "local" && rec.modelId).toBe("large-8b");
  });

  it("mid laptop (8GB, 2GB buffer) → 4B", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 8,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 2 * GB,
        },
      }),
      CATALOGUE,
    );
    expect(rec.kind === "local" && rec.modelId).toBe("mid-4b");
  });

  it("low-memory phone (2GB, 1GB buffer) → only the 1B fits", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 2,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 1 * GB,
        },
      }),
      CATALOGUE,
    );
    expect(rec.kind === "local" && rec.modelId).toBe("tiny-1b");
  });

  it("no-WebGPU browser → server-only with a WebGPU reason", () => {
    const rec = recommendModel(
      {
        webgpu: { available: false, adapterGranted: false },
        webllmSupported: false,
      },
      CATALOGUE,
    );
    expect(rec.kind).toBe("server-only");
    expect(rec.reason).toContain("doesn't support WebGPU");
  });

  it("WebGPU present but no adapter granted → server-only (distinct reason)", () => {
    const rec = recommendModel(
      {
        webgpu: { available: true, adapterGranted: false },
        webllmSupported: false,
      },
      CATALOGUE,
    );
    expect(rec.kind).toBe("server-only");
    expect(rec.reason).toContain("couldn't grant");
  });

  it("tiny GPU buffer caps a big-RAM machine → server-only", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 32,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 128 * 1024 * 1024, // 128MB → budget 512MB
        },
      }),
      CATALOGUE,
    );
    expect(rec.kind).toBe("server-only");
    expect(rec.reason).toContain("too limited");
  });

  it("ties break toward the lighter build at equal params", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 16,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 4 * GB,
        },
      }),
      [
        { id: "heavy-4b", requiredVramMb: 4000, approxParamsB: 4 },
        { id: "light-4b", requiredVramMb: 3000, approxParamsB: 4 },
      ],
    );
    expect(rec.kind === "local" && rec.modelId).toBe("light-4b");
  });
});

describe("recommendModel — shipped catalogue default", () => {
  it("capable device recommends the shipped webllm-qwen3-4b", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 8,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 4 * GB,
        },
      }),
    );
    expect(rec.kind === "local" && rec.modelId).toBe("webllm-qwen3-4b");
    expect(SHIPPED_LOCAL_MODEL_CANDIDATES[0]?.id).toBe("webllm-qwen3-4b");
  });

  it("weak device falls back to server-only with the shipped catalogue", () => {
    const rec = recommendModel(
      profile({
        deviceMemoryGb: 2,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 512 * 1024 * 1024,
        },
      }),
    );
    expect(rec.kind).toBe("server-only");
  });
});

describe("estimateVramBudgetMb", () => {
  it("min of memory budget and GPU-buffer-derived cap", () => {
    // mem 8*1024*0.55 = 4505.6 ; gpu (2048MB * 4) = 8192 → min 4505.6
    const budget = estimateVramBudgetMb(
      profile({
        deviceMemoryGb: 8,
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 2 * GB,
        },
      }),
    );
    expect(budget).toBeCloseTo(4505.6, 1);
  });

  it("unknown memory falls back to the conservative default (2048), still GPU-capped", () => {
    const budget = estimateVramBudgetMb(
      profile({
        webgpu: {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: 8 * GB,
        },
      }),
    );
    expect(budget).toBe(2048);
  });

  it("unknown GPU limits → memory alone drives the budget", () => {
    const budget = estimateVramBudgetMb(
      profile({ deviceMemoryGb: 16 }),
    );
    expect(budget).toBeCloseTo(16 * 1024 * 0.55, 1);
  });
});

describe("candidatesFromRegistry + recommendedModelId", () => {
  it("maps a known registry id to its real requirement", () => {
    const [candidate] = candidatesFromRegistry(["webllm-qwen3-4b"]);
    expect(candidate).toEqual({
      id: "webllm-qwen3-4b",
      requiredVramMb: 3431,
      approxParamsB: 4,
    });
  });

  it("maps an unknown id to the conservative fallback (8B / 4608MB)", () => {
    const [candidate] = candidatesFromRegistry(["webllm-future-x"]);
    expect(candidate?.requiredVramMb).toBe(4608);
    expect(candidate?.approxParamsB).toBe(8);
  });

  it("recommendedModelId extracts local id / null for server-only", () => {
    expect(
      recommendedModelId({
        kind: "local",
        modelId: "webllm-qwen3-4b",
        reason: "x",
        estimatedVramBudgetMb: 4000,
      }),
    ).toBe("webllm-qwen3-4b");
    expect(
      recommendedModelId({
        kind: "server-only",
        reason: "x",
        estimatedVramBudgetMb: 100,
      }),
    ).toBeNull();
  });
});
