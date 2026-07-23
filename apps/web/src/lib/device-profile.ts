/**
 * device-profile.ts — browser device-capability profiling (DX Phase 0).
 *
 * Pure, dependency-free capture of the hardware/capability signals a visitor's
 * browser exposes WITHOUT any permission prompt — the input to
 * `recommendModel()` (model-recommendation.ts). This is the "Phase 0" slice of
 * the distributed-inference plan
 * (.planning/research/2026-07-23-distributed-inference-phase-plan.md §6.1 of
 * the E7 research): device profiling + a local-model recommendation, with NO
 * peer pooling, NO credits, NO remote-peer routing (all E7-gated).
 *
 * Every signal degrades gracefully: an absent API yields `undefined` (never a
 * throw), so the profiler runs identically on Chrome (rich signals), Safari
 * (no `deviceMemory`/`connection`), and SSR (no `navigator` at all). WebGPU
 * detection reuses the exact predicate shape as use-webllm-engine.ts's
 * `detectWebGpuSupport()` so the picker's "supported" gate and the
 * recommendation agree.
 *
 * Testability: `profileDevice()` reads from an injectable `NavigatorLike`
 * (defaulting to the ambient `navigator`), so vitest can mock a high-end GPU, a
 * mid laptop, a low-memory phone, or a no-WebGPU browser without touching the
 * real environment.
 */

// ---------------------------------------------------------------------------
// Structural navigator shape — the SUBSET this module reads, all optional.
// A structural (not nominal) type so tests pass a plain object literal and so
// we never depend on lib.dom's evolving `Navigator.gpu`/`deviceMemory` typings
// (deviceMemory + NetworkInformation are still non-standard in TS's lib).
// ---------------------------------------------------------------------------

export interface AdapterInfoLike {
  readonly vendor?: string;
  readonly architecture?: string;
}

export interface AdapterLimitsLike {
  readonly maxBufferSize?: number;
  readonly maxStorageBufferBindingSize?: number;
}

export interface GpuAdapterLike {
  readonly limits?: AdapterLimitsLike;
  /** Chromium exposes `adapter.info` synchronously in 2026; older builds put
   * it behind `requestAdapterInfo()`. We read the property form only. */
  readonly info?: AdapterInfoLike;
}

export interface GpuLike {
  requestAdapter(): Promise<GpuAdapterLike | null>;
}

export interface NetworkInformationLike {
  readonly effectiveType?: string;
  readonly saveData?: boolean;
}

export interface NavigatorLike {
  readonly hardwareConcurrency?: number;
  readonly deviceMemory?: number;
  readonly gpu?: GpuLike;
  readonly connection?: NetworkInformationLike;
}

// ---------------------------------------------------------------------------
// The profile — the pure output the recommender consumes.
// ---------------------------------------------------------------------------

export interface WebGpuProfile {
  /** `navigator.gpu` present (feature-detect) — the gate WebLLM needs. */
  readonly available: boolean;
  /** An adapter was actually granted (some browsers expose `gpu` but return
   * null adapters, e.g. blocklisted drivers / headless). */
  readonly adapterGranted: boolean;
  /** Hard cap on a single GPU buffer allocation (bytes) — a coarse ceiling on
   * the largest weight shard a model can load. */
  readonly maxBufferSizeBytes?: number;
  readonly maxStorageBufferBindingSizeBytes?: number;
  readonly adapterVendor?: string;
  readonly adapterArchitecture?: string;
}

export interface DeviceProfile {
  /** `navigator.hardwareConcurrency` — logical CPU cores (coarse CPU tier). */
  readonly logicalCores?: number;
  /** `navigator.deviceMemory` — GiB of RAM, Chromium-clamped to 8 (so it
   * under-reports high-end machines; the recommender leans on WebGPU limits to
   * separate the top tier). Absent on Safari/Firefox. */
  readonly deviceMemoryGb?: number;
  readonly webgpu: WebGpuProfile;
  /** WebLLM can run here at all: requires WebGPU with a granted adapter. */
  readonly webllmSupported: boolean;
  /** `navigator.connection.effectiveType` ("4g" | "3g" | "slow-2g" | …) —
   * relevant to the one-time ~GB weight download, not to inference. */
  readonly connectionType?: string;
  /** Data-saver mode on — a signal against pushing a large local download. */
  readonly saveData?: boolean;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** The ambient navigator, or `undefined` under SSR / non-browser runtimes. */
function ambientNavigator(): NavigatorLike | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as unknown as NavigatorLike);
}

/**
 * WebGPU presence predicate — mirrors use-webllm-engine.ts's
 * `detectWebGpuSupport()` so the picker's enable gate and the recommendation
 * never disagree. Presence of `navigator.gpu` only; adapter grant is probed
 * separately (async) in `profileDevice`.
 */
export function detectWebGpuSupport(nav: NavigatorLike | undefined): boolean {
  return nav !== undefined && nav.gpu !== undefined;
}

/** Positive finite number, else undefined — guards against 0 / NaN / negatives
 * that some polyfills report. */
function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/**
 * Capture the device profile. Async only because WebGPU adapter probing is
 * async (`requestAdapter()`); every read is individually guarded so a missing
 * API or a rejected adapter request degrades to `undefined`, never a throw.
 *
 * @param nav Injectable navigator (defaults to the ambient one) — the seam
 *            vitest uses to simulate device classes.
 */
export async function profileDevice(
  nav: NavigatorLike | undefined = ambientNavigator(),
): Promise<DeviceProfile> {
  const webgpuAvailable = detectWebGpuSupport(nav);

  let webgpu: WebGpuProfile = {
    available: webgpuAvailable,
    adapterGranted: false,
  };

  if (webgpuAvailable && nav?.gpu !== undefined) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter !== null) {
        webgpu = {
          available: true,
          adapterGranted: true,
          maxBufferSizeBytes: positiveNumber(adapter.limits?.maxBufferSize),
          maxStorageBufferBindingSizeBytes: positiveNumber(
            adapter.limits?.maxStorageBufferBindingSize,
          ),
          adapterVendor: adapter.info?.vendor,
          adapterArchitecture: adapter.info?.architecture,
        };
      }
    } catch {
      // Adapter request rejected (blocklisted driver, headless, OOM) — keep the
      // "available but not granted" profile; the recommender treats no grant as
      // "can't run local".
    }
  }

  return {
    logicalCores: positiveNumber(nav?.hardwareConcurrency),
    deviceMemoryGb: positiveNumber(nav?.deviceMemory),
    webgpu,
    // WebLLM needs a real, granted WebGPU adapter — presence alone isn't enough.
    webllmSupported: webgpu.adapterGranted,
    connectionType: nav?.connection?.effectiveType,
    saveData: nav?.connection?.saveData,
  };
}
