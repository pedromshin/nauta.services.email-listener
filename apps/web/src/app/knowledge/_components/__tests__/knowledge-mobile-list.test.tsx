/**
 * knowledge-mobile-list.test.tsx — 53-06-PLAN.md Task 2: proves `/knowledge`'s
 * MOBL-01 mobile list + full-width detail sheet (53-UI-SPEC.md §3 "/knowledge
 * mobile list + detail sheet") without regressing the desktop graph.
 *
 * Mounts the real `KnowledgeSurface` component — the client wrapper
 * `page.tsx` renders instead of `KnowledgeGraphIsland` directly. Mocks
 * `~/hooks/use-is-mobile-viewport` (mutable module-level `let`, mirrors
 * `chat-mobile-feed.test.tsx`'s (53-05) convention so one file exercises
 * both the mobile-forced and desktop cases), `./knowledge-graph-island` (a
 * spy — proves it is never invoked below `md`), and `~/trpc/react`'s
 * `api.knowledge.graph.useQuery` (a couple of fake nodes, one
 * `entity_type` + one `entity_type_field`, matching `KnowledgeMobileList`'s
 * `DEFAULT_VISIBLE_TYPES`).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mutable across tests (see file doc comment) — defaults true (mobile) since
// most of this suite's cases exercise the mobile-forced path.
let mockIsMobile = true;

vi.mock("~/hooks/use-is-mobile-viewport", () => ({
  useIsMobileViewport: () => mockIsMobile,
}));

const knowledgeGraphIslandMock = vi.fn((_props: unknown) => null);

vi.mock("../knowledge-graph-island", () => ({
  KnowledgeGraphIsland: (props: unknown) => knowledgeGraphIslandMock(props),
}));

const FAKE_NODES = [
  { id: "node-1", type: "entity_type", label: "Invoice" },
  { id: "node-2", type: "entity_type_field", label: "Invoice Number" },
];

vi.mock("~/trpc/react", () => ({
  api: {
    knowledge: {
      graph: {
        useQuery: () => ({
          data: { nodes: FAKE_NODES, edges: [] },
          isError: false,
        }),
      },
    },
  },
}));

import { KnowledgeSurface } from "../knowledge-surface";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE_DETAIL_PANE_SOURCE = readFileSync(
  path.join(__dirname, "..", "node-detail-pane.tsx"),
  "utf-8",
);
const PAGE_SOURCE = readFileSync(
  path.join(__dirname, "..", "..", "page.tsx"),
  "utf-8",
);

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

/** Row buttons (node list) never carry `aria-pressed` — only the filter
 * chips do — so this distinguishes the two without a test id. */
function rowButtons(container: HTMLDivElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) => !button.hasAttribute("aria-pressed"),
  );
}

function chipButton(container: HTMLDivElement, label: string): HTMLButtonElement {
  const chip = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
  ).find((button) => button.textContent?.includes(label));
  if (!chip) throw new Error(`chip "${label}" not found`);
  return chip;
}

afterEach(() => {
  for (const c of containers) {
    document.body.removeChild(c);
  }
  containers = [];
  document.body
    .querySelectorAll('[role="dialog"], [data-radix-portal]')
    .forEach((node) => node.remove());
  knowledgeGraphIslandMock.mockClear();
  mockIsMobile = true;
});

describe("/knowledge mobile list — useIsMobileViewport mocked true (MOBL-01, 53-UI-SPEC §3)", () => {
  it("KnowledgeGraphIsland is never mounted", async () => {
    mockIsMobile = true;
    await mount(<KnowledgeSurface />);
    expect(knowledgeGraphIslandMock).not.toHaveBeenCalled();
  });

  it("the filter-chip bar and node rows render", async () => {
    mockIsMobile = true;
    const container = await mount(<KnowledgeSurface />);

    expect(
      container.querySelector('[role="group"][aria-label="Filter by type"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Invoice");
    expect(container.textContent).toContain("Invoice Number");
  });

  it("toggling a filter chip changes which rows show", async () => {
    mockIsMobile = true;
    const container = await mount(<KnowledgeSurface />);

    expect(container.textContent).toContain("Invoice Number");

    await act(async () => {
      chipButton(container, "Fields").click();
    });

    expect(container.textContent).not.toContain("Invoice Number");
    // The entity_type row ("Invoice") stays visible — only "Fields" toggled off.
    expect(rowButtons(container).some((b) => b.textContent?.includes("Invoice"))).toBe(
      true,
    );
  });

  it("clicking a row opens the detail Sheet (NodeDetailPane content appears)", async () => {
    mockIsMobile = true;
    const container = await mount(<KnowledgeSurface />);

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    const row = rowButtons(container).find((b) => b.textContent?.includes("Invoice"));
    if (!row) throw new Error("node row not found");

    await act(async () => {
      row.click();
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Invoice");
    expect(dialog?.textContent).toContain("Entity Type");
  });
});

describe("/knowledge desktop path — useIsMobileViewport mocked false (regression)", () => {
  it("KnowledgeGraphIsland mounts and the mobile list does not render", async () => {
    mockIsMobile = false;
    const container = await mount(<KnowledgeSurface />);

    expect(knowledgeGraphIslandMock).toHaveBeenCalled();
    expect(
      container.querySelector('[role="group"][aria-label="Filter by type"]'),
    ).toBeNull();
  });
});

describe("(source) node-detail-pane.tsx suppresses its internal close below md", () => {
  it("the internal close Button className contains hidden md:inline-flex", () => {
    expect(NODE_DETAIL_PANE_SOURCE).toContain("hidden md:inline-flex");
  });
});

describe("(source) knowledge/page.tsx renders KnowledgeSurface, not KnowledgeGraphIsland directly", () => {
  it("imports and renders KnowledgeSurface", () => {
    expect(PAGE_SOURCE).toContain("KnowledgeSurface");
    expect(PAGE_SOURCE).not.toContain("<KnowledgeGraphIsland");
  });

  it("stays a server component with metadata intact", () => {
    expect(PAGE_SOURCE).toContain("export const metadata");
    // Checks the literal directive (own line), not the phrase inside prose
    // comments describing KnowledgeSurface's own "use client" boundary.
    expect(PAGE_SOURCE).not.toMatch(/^"use client";?$/m);
  });
});
