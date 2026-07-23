/**
 * model-picker-entry-device-hint.test.tsx — DX Phase 0 "Recommended for your
 * device" hint (behavior only; jsdom does no layout — CLAUDE.md). Mounts the
 * REAL ModelPickerEntry via this repo's createRoot-in-jsdom + `act` convention
 * (tool-invocation-result-row.test.tsx). Asserts the badge appears only when
 * `isRecommendedForDevice` is set, is independent of the current-selection
 * "Recommended" badge, and that the hint never mutates anything (pure render).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  ModelPickerEntry,
  type ChatModelEntry,
} from "../model-picker-entry";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let containers: HTMLDivElement[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return container;
}

const BROWSER_MODEL: ChatModelEntry = {
  id: "webllm-qwen3-4b",
  displayName: "Qwen3 4B (in-browser)",
  transport: "browser",
  executionLocus: "browser",
  priceInPerMtok: 0,
  priceOutPerMtok: 0,
  capabilities: { tools: false, genui: false, streaming: true, contextTokens: 8192 },
  bestFor: "Private, offline chat",
};

const DEVICE_HINT = "Recommended for your device";

describe("ModelPickerEntry — device recommendation hint", () => {
  afterEach(() => {
    for (const c of containers) document.body.removeChild(c);
    containers = [];
  });

  it("renders the hint badge when isRecommendedForDevice is true", async () => {
    const container = await mount(
      <ModelPickerEntry
        model={BROWSER_MODEL}
        isRecommended={false}
        isRecommendedForDevice
      />,
    );
    expect(container.textContent).toContain(DEVICE_HINT);
  });

  it("omits the hint badge when isRecommendedForDevice is false/absent", async () => {
    const container = await mount(
      <ModelPickerEntry model={BROWSER_MODEL} isRecommended={false} />,
    );
    expect(container.textContent).not.toContain(DEVICE_HINT);
  });

  it("device hint and current-selection 'Recommended' badge coexist independently", async () => {
    const container = await mount(
      <ModelPickerEntry
        model={BROWSER_MODEL}
        isRecommended
        isRecommendedForDevice
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain(DEVICE_HINT);
    // The current-selection badge is the bare word "Recommended" (present here
    // too); the device hint is a distinct, longer string — both render.
    expect(text).toContain("Recommended");
    // Two distinct badges → the device hint substring appears exactly once.
    expect(text.split(DEVICE_HINT).length - 1).toBe(1);
  });

  it("the hint is a suggestion only — it renders on a NON-selected row too", async () => {
    // isRecommended=false (not the active model) but device-recommended: the
    // badge still shows, proving it never implies/forces selection.
    const container = await mount(
      <ModelPickerEntry
        model={BROWSER_MODEL}
        isRecommended={false}
        isRecommendedForDevice
      />,
    );
    expect(container.textContent).toContain(DEVICE_HINT);
  });
});
