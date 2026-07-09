/**
 * provenance-link.test.tsx — ProvenanceLink (TUI-02) unit tests: hrefFor's
 * fixed kind+id -> path switch (encodeURIComponent-wrapped), fallbackLabel's
 * exact format, the mount smoke test (real <a>, fallback text vs explicit
 * label override), and the stopPropagation guard.
 *
 * Mounts the REAL component — mirrors this repo's createRoot-in-jsdom + `act`
 * convention (generating-ring.test.tsx).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { fallbackLabel, hrefFor, ProvenanceLink } from "./provenance-link";

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

describe("hrefFor", () => {
  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  // Test 1
  it("computes the 3 fixed kind routes, encodeURIComponent-wrapping the id", () => {
    expect(hrefFor("email", "abc123")).toBe("/emails/abc123");
    expect(hrefFor("entity", "abc123")).toBe("/entities/abc123");
    expect(hrefFor("knowledge", "abc123")).toBe("/knowledge?focus=abc123");
  });

  it("encodeURIComponent-wraps an id containing characters URL-encoding changes", () => {
    expect(hrefFor("email", "a b/c")).toBe(`/emails/${encodeURIComponent("a b/c")}`);
    expect(hrefFor("entity", "a b/c")).toBe(`/entities/${encodeURIComponent("a b/c")}`);
    expect(hrefFor("knowledge", "a b/c")).toBe(
      `/knowledge?focus=${encodeURIComponent("a b/c")}`,
    );
  });
});

describe("fallbackLabel", () => {
  // Test 2
  it("formats as '{Capitalized kind} · {first 8 chars of id}'", () => {
    expect(fallbackLabel("email", "a3f21b8e9911")).toBe("Email · a3f21b8e");
    expect(fallbackLabel("entity", "a3f21b8e9911")).toBe("Entity · a3f21b8e");
    expect(fallbackLabel("knowledge", "a3f21b8e9911")).toBe("Knowledge · a3f21b8e");
  });
});

describe("ProvenanceLink", () => {
  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  // Test 3
  it("mounts to a real <a> with href=hrefFor(kind,id) and text=fallbackLabel(kind,id) when no label is passed", async () => {
    const container = await mount(<ProvenanceLink kind="entity" id="e1" />);
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe(hrefFor("entity", "e1"));
    expect(anchor?.textContent).toBe(fallbackLabel("entity", "e1"));
  });

  // Test 4
  it("an explicit label prop overrides the fallback", async () => {
    const container = await mount(
      <ProvenanceLink kind="entity" id="e1" label="Acme Corp" />,
    );
    const anchor = container.querySelector("a");
    expect(anchor?.textContent).toBe("Acme Corp");
  });

  // Test 5
  it("the rendered <a> has a non-null onclick handler (the stopPropagation guard)", async () => {
    const container = await mount(<ProvenanceLink kind="email" id="e1" />);
    const anchor = container.querySelector("a") as HTMLAnchorElement;
    expect(anchor.onclick).not.toBeNull();
  });
});
