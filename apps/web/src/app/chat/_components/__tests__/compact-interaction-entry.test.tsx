/**
 * compact-interaction-entry.test.tsx — 24-05 fix pass (24-UI-REVIEW.md Copywriting
 * Contract violation #2): CompactInteractionEntry's clarify branch must route through
 * the mandated `key-value-list` catalog primitive (aria-label="Your response") — the
 * SAME mechanism SubmittedClarifyView already uses — instead of a hand-rolled `<dl>`
 * with no accessible name.
 *
 * Mounts the REAL SpecRenderer path (via GenuiPartBoundary, no mocks) — mirrors
 * interactive-widget-boundary.test.tsx's createRoot-in-jsdom + `act` convention.
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CompactInteractionEntry } from "../compact-interaction-entry";

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

describe("CompactInteractionEntry", () => {
  beforeEach(() => {
    containers = [];
  });

  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  it("proposal_cards: unaffected — still renders 'Selected \"{title}\"'", async () => {
    const container = await mount(
      <CompactInteractionEntry widgetKind="proposal_cards" summary={{ chosenTitle: "Ship next week" }} />,
    );
    expect(container.textContent).toContain('Selected "Ship next week"');
  });

  it("confirm_action: reuses ProposalSummary — renders 'Selected \"Confirm\"', not the clarify key-value-list path", async () => {
    const container = await mount(
      <CompactInteractionEntry widgetKind="confirm_action" summary={{ chosenTitle: "Confirm" }} />,
    );
    expect(container.textContent).toContain('Selected "Confirm"');
    expect(container.querySelector('dl[aria-label="Your response"]')).toBeNull();
  });

  it("clarify_widget: routes through the key-value-list catalog primitive with aria-label='Your response'", async () => {
    const container = await mount(
      <CompactInteractionEntry
        widgetKind="clarify_widget"
        summary={{
          fields: [
            { label: "Email", value: "alice@example.com" },
            { label: "Subscribe", value: true },
          ],
        }}
      />,
    );

    const dl = container.querySelector('dl[aria-label="Your response"]');
    expect(dl).not.toBeNull();
    expect(container.textContent).toContain("Email");
    expect(container.textContent).toContain("alice@example.com");
    expect(container.textContent).toContain("Subscribe");
    expect(container.textContent).toContain("Yes");
  });

  it("clarify_widget: a false boolean field value renders 'No'", async () => {
    const container = await mount(
      <CompactInteractionEntry
        widgetKind="clarify_widget"
        summary={{ fields: [{ label: "Newsletter", value: false }] }}
      />,
    );
    expect(container.textContent).toContain("No");
  });
});
