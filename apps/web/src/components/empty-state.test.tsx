/**
 * empty-state.test.tsx — EmptyState (FIX-11) variant tests: spacious icon/heading
 * register, inline+destructive tone without full-pane centering, action button
 * wiring, and caption rendering.
 *
 * Mounts the REAL component — mirrors this repo's createRoot-in-jsdom + `act`
 * convention (json-pane.test.tsx / interactive-widget-boundary.test.tsx).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, MessageSquarePlus, Plus } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "./empty-state";

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

describe("EmptyState", () => {
  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  it("size=spacious renders a size-10 icon and a text-2xl heading", async () => {
    const container = await mount(
      <EmptyState
        icon={MessageSquarePlus}
        heading="Start a new conversation"
        body="Ask the agent anything."
        size="spacious"
      />,
    );

    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("class")).toContain("size-10");
    expect(icon!.getAttribute("aria-hidden")).toBe("true");

    const heading = container.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading!.className).toContain("text-2xl");
    expect(heading!.textContent).toBe("Start a new conversation");
  });

  it("layout=inline + tone=destructive renders the destructive icon tint and does not apply full-pane centering", async () => {
    const container = await mount(
      <EmptyState
        icon={AlertTriangle}
        heading="This panel type isn't supported in this version."
        body=""
        layout="inline"
        tone="destructive"
        size="compact"
        caption="Type: mystery-node · The canvas layout is unaffected."
      />,
    );

    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("class")).toContain("text-destructive");
    expect(icon!.getAttribute("class")).toContain("size-4");

    // Inline layout must never reach for viewport-relative full-pane
    // centering (no absolute/fixed positioning anywhere in its markup).
    expect(container.innerHTML).not.toContain("absolute inset-0");
    expect(container.innerHTML).not.toContain("fixed");

    expect(container.textContent).toContain(
      "Type: mystery-node · The canvas layout is unaffected.",
    );
  });

  it("renders the action button and calls onClick", async () => {
    const onClick = vi.fn();
    const container = await mount(
      <EmptyState
        icon={MessageSquarePlus}
        heading="Start a new conversation"
        body="Ask the agent anything."
        size="spacious"
        action={{ label: "New chat", icon: Plus, onClick }}
      />,
    );

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain("New chat");

    await act(async () => {
      button!.click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the caption when set", async () => {
    const container = await mount(
      <EmptyState
        icon={AlertTriangle}
        heading="This panel type isn't supported in this version."
        body=""
        layout="inline"
        tone="destructive"
        caption="Type: unknown-widget · skipped safely."
      />,
    );

    expect(container.textContent).toContain("Type: unknown-widget · skipped safely.");
  });

  it("omits the caption element when not set", async () => {
    const container = await mount(
      <EmptyState
        icon={MessageSquarePlus}
        heading="No panels yet"
        body="Genui responses will appear here."
        size="compact"
      />,
    );

    expect(container.textContent).not.toContain("Type:");
  });
});
