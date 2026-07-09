/**
 * json-pane.test.tsx — JsonPane (FIX-05) unit tests: renders the formatted
 * (2-space-indented) JSON body, and its copy button writes that same string to
 * the clipboard while swapping the Copy icon to Check.
 *
 * Mounts the REAL component — mirrors this repo's createRoot-in-jsdom + `act`
 * convention (interactive-widget-boundary.test.tsx). jsdom does not implement
 * ResizeObserver, which @polytoken/ui's ScrollArea (Radix) requires on mount, so a
 * minimal stub is installed before mounting.
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JsonPane } from "./json-pane";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;

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

describe("JsonPane", () => {
  beforeEach(() => {
    containers = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  it("renders the formatted (2-space-indented) JSON text under the given label", async () => {
    const value = { hello: "world", count: 2 };
    const container = await mount(<JsonPane value={value} label="Spec JSON" />);

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toBe(JSON.stringify(value, null, 2));
    expect(container.textContent).toContain("Spec JSON");
  });

  it("clicking copy writes the formatted JSON to the clipboard and swaps Copy -> Check", async () => {
    const value = { a: 1 };
    const formatted = JSON.stringify(value, null, 2);
    const container = await mount(<JsonPane value={value} />);

    expect(container.querySelector(".lucide-copy")).not.toBeNull();
    expect(container.querySelector(".lucide-check")).toBeNull();

    const button = container.querySelector(
      '[aria-label="Copy JSON"]',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    await act(async () => {
      button!.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(formatted);
    expect(container.querySelector(".lucide-check")).not.toBeNull();
    expect(container.querySelector(".lucide-copy")).toBeNull();
  });
});
