/**
 * device-profile.test.ts — profileDevice()/detectWebGpuSupport() across device
 * classes with a mocked NavigatorLike (no real browser, no real WebGPU). jsdom
 * runs this but the module is environment-pure — every signal is injected.
 */

import { describe, expect, it } from "vitest";

import {
  detectWebGpuSupport,
  profileDevice,
  type GpuAdapterLike,
  type NavigatorLike,
} from "./device-profile";

function gpuReturning(
  adapter: GpuAdapterLike | null,
): NavigatorLike["gpu"] {
  return { requestAdapter: () => Promise.resolve(adapter) };
}

describe("detectWebGpuSupport", () => {
  it("false when navigator is undefined (SSR)", () => {
    expect(detectWebGpuSupport(undefined)).toBe(false);
  });

  it("false when navigator has no gpu", () => {
    expect(detectWebGpuSupport({})).toBe(false);
  });

  it("true when navigator.gpu is present", () => {
    expect(detectWebGpuSupport({ gpu: gpuReturning(null) })).toBe(true);
  });
});

describe("profileDevice — device classes", () => {
  it("high-end discrete GPU: rich WebGPU limits + adapter info captured", async () => {
    const nav: NavigatorLike = {
      hardwareConcurrency: 24,
      deviceMemory: 8, // Chromium clamps even a 64GB machine to 8
      gpu: gpuReturning({
        limits: {
          maxBufferSize: 4 * 1024 * 1024 * 1024,
          maxStorageBufferBindingSize: 2 * 1024 * 1024 * 1024,
        },
        info: { vendor: "nvidia", architecture: "ada-lovelace" },
      }),
      connection: { effectiveType: "4g", saveData: false },
    };

    const profile = await profileDevice(nav);

    expect(profile.logicalCores).toBe(24);
    expect(profile.deviceMemoryGb).toBe(8);
    expect(profile.webgpu.available).toBe(true);
    expect(profile.webgpu.adapterGranted).toBe(true);
    expect(profile.webgpu.maxBufferSizeBytes).toBe(4 * 1024 * 1024 * 1024);
    expect(profile.webgpu.adapterVendor).toBe("nvidia");
    expect(profile.webgpu.adapterArchitecture).toBe("ada-lovelace");
    expect(profile.webllmSupported).toBe(true);
    expect(profile.connectionType).toBe("4g");
    expect(profile.saveData).toBe(false);
  });

  it("mid laptop (integrated GPU): adapter granted with modest buffer limits", async () => {
    const nav: NavigatorLike = {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      gpu: gpuReturning({
        limits: { maxBufferSize: 2 * 1024 * 1024 * 1024 },
        info: { vendor: "intel", architecture: "gen-12" },
      }),
    };

    const profile = await profileDevice(nav);

    expect(profile.webllmSupported).toBe(true);
    expect(profile.webgpu.maxBufferSizeBytes).toBe(2 * 1024 * 1024 * 1024);
    // deviceMemory present; connection absent -> undefined, not a throw.
    expect(profile.connectionType).toBeUndefined();
    expect(profile.saveData).toBeUndefined();
  });

  it("low-memory phone: WebGPU present, small memory, save-data on", async () => {
    const nav: NavigatorLike = {
      hardwareConcurrency: 4,
      deviceMemory: 2,
      gpu: gpuReturning({
        limits: { maxBufferSize: 256 * 1024 * 1024 },
        info: { vendor: "qualcomm", architecture: "adreno" },
      }),
      connection: { effectiveType: "3g", saveData: true },
    };

    const profile = await profileDevice(nav);

    expect(profile.deviceMemoryGb).toBe(2);
    expect(profile.webllmSupported).toBe(true);
    expect(profile.saveData).toBe(true);
    expect(profile.connectionType).toBe("3g");
  });

  it("no-WebGPU browser (Safari-ish): no gpu, no deviceMemory/connection", async () => {
    const nav: NavigatorLike = { hardwareConcurrency: 8 };

    const profile = await profileDevice(nav);

    expect(profile.webgpu.available).toBe(false);
    expect(profile.webgpu.adapterGranted).toBe(false);
    expect(profile.webllmSupported).toBe(false);
    expect(profile.deviceMemoryGb).toBeUndefined();
    expect(profile.logicalCores).toBe(8);
  });

  it("WebGPU present but adapter request returns null (blocklisted driver)", async () => {
    const nav: NavigatorLike = {
      deviceMemory: 8,
      gpu: gpuReturning(null),
    };

    const profile = await profileDevice(nav);

    expect(profile.webgpu.available).toBe(true);
    expect(profile.webgpu.adapterGranted).toBe(false);
    expect(profile.webllmSupported).toBe(false);
  });

  it("WebGPU adapter request rejects (throws) -> degrades, no throw", async () => {
    const nav: NavigatorLike = {
      deviceMemory: 8,
      gpu: { requestAdapter: () => Promise.reject(new Error("headless")) },
    };

    const profile = await profileDevice(nav);

    expect(profile.webgpu.available).toBe(true);
    expect(profile.webgpu.adapterGranted).toBe(false);
    expect(profile.webllmSupported).toBe(false);
  });

  it("garbage numeric signals (0 / NaN / negative) are dropped to undefined", async () => {
    const nav: NavigatorLike = {
      hardwareConcurrency: 0,
      deviceMemory: Number.NaN,
      gpu: gpuReturning({ limits: { maxBufferSize: -1 } }),
    };

    const profile = await profileDevice(nav);

    expect(profile.logicalCores).toBeUndefined();
    expect(profile.deviceMemoryGb).toBeUndefined();
    expect(profile.webgpu.maxBufferSizeBytes).toBeUndefined();
  });

  it("default arg falls back to the ambient navigator (jsdom: no WebGPU → unsupported)", async () => {
    // jsdom always defines `navigator` (with no `gpu`), so the no-arg / undefined
    // path resolves to it, not a synthetic SSR nav. The true SSR path
    // (`typeof navigator === "undefined"`) is covered by
    // detectWebGpuSupport(undefined) above.
    const profile = await profileDevice();

    expect(profile.webgpu.available).toBe(false);
    expect(profile.webllmSupported).toBe(false);
  });
});
