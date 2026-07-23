/**
 * omnibox.test.tsx — jsdom BEHAVIOR tests for the Cmd/Ctrl+K omnibox (AI-05):
 * closed by default, opens/closes on the shortcut, renders grouped results,
 * and selecting a row navigates via the result's href.
 *
 * Mounts the REAL component with `~/trpc/react` and `next/navigation` mocked
 * — this repo's createRoot-in-jsdom + `act` convention
 * (pipeline-health-panel.test.tsx et al.). jsdom does no layout: NOTHING
 * here is a visual claim — no geometry, overflow, or theme assertions. The
 * real-browser gates (test:geometry / screenshot:review) own that.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OmniboxResult } from "../omnibox";

// ---------------------------------------------------------------------------
// Mocks — hoisted before the component import below
// ---------------------------------------------------------------------------

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const useQueryMock = vi.fn();
vi.mock("~/trpc/react", () => ({
  api: {
    search: {
      omnibox: {
        useQuery: (...args: unknown[]) => useQueryMock(...args),
      },
    },
  },
}));

import { groupOmniboxResults, Omnibox } from "../omnibox";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RESULTS: OmniboxResult[] = [
  {
    kind: "entity",
    id: "e1",
    title: "Acme GmbH",
    subtitle: "Supplier",
    href: "/entities/e1",
  },
  {
    kind: "email",
    id: "m1",
    title: "Acme invoice",
    subtitle: "Jane at Acme",
    href: "/emails/m1",
  },
  { kind: "file", id: "acme.pdf", title: "acme.pdf", href: "/files" },
];

// ---------------------------------------------------------------------------
// Harness (createRoot-in-jsdom + act convention)
// ---------------------------------------------------------------------------

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let containers: HTMLDivElement[] = [];
let roots: Root[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return container;
}

beforeEach(() => {
  // cmdk scrolls the selected item into view; jsdom has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  // Radix internals may observe size; jsdom has no ResizeObserver.
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  useQueryMock.mockReturnValue({
    data: { results: RESULTS },
    isError: false,
    isFetching: false,
  });
});

afterEach(async () => {
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  roots = [];
  for (const c of containers) {
    document.body.removeChild(c);
  }
  containers = [];
  pushMock.mockReset();
  useQueryMock.mockReset();
  vi.restoreAllMocks();
});

function pressCtrlK(): Promise<void> {
  return act(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );
  });
}

/** The dialog renders in a Radix portal — query the DOCUMENT, not the container. */
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[role=dialog]");
}

async function typeQuery(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("[cmdk-input]");
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setter.call(input, text);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    // debounceMs={0} in these tests — one macrotask settles the debounce.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Omnibox — open/close behavior (jsdom, behavior only)", () => {
  it("is closed by default and opens on Ctrl+K", async () => {
    await mount(<Omnibox debounceMs={0} />);
    expect(dialog()).toBeNull();

    await pressCtrlK();
    expect(dialog()).not.toBeNull();
    expect(
      document.querySelector<HTMLInputElement>("[cmdk-input]"),
    ).not.toBeNull();
  });

  it("toggles closed on a second Ctrl+K and opens via metaKey too", async () => {
    await mount(<Omnibox debounceMs={0} />);
    await pressCtrlK();
    expect(dialog()).not.toBeNull();
    await pressCtrlK();
    expect(dialog()).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "K", metaKey: true, bubbles: true }),
      );
    });
    expect(dialog()).not.toBeNull();
  });

  it("shows the minimum-length hint until 2 characters are typed, and never queries below it", async () => {
    await mount(<Omnibox debounceMs={0} />);
    await pressCtrlK();

    expect(document.body.textContent).toContain(
      "Type at least 2 characters to search.",
    );

    await typeQuery("a");
    expect(document.body.textContent).toContain(
      "Type at least 2 characters to search.",
    );
    // Every useQuery call so far was disabled (enabled: false).
    for (const call of useQueryMock.mock.calls) {
      expect((call[1] as { enabled: boolean }).enabled).toBe(false);
    }
  });
});

describe("Omnibox — grouped results + selection", () => {
  it("renders results grouped by kind with labelled headings", async () => {
    await mount(<Omnibox debounceMs={0} />);
    await pressCtrlK();
    await typeQuery("acme");

    // The query became enabled with the typed term.
    const lastCall = useQueryMock.mock.calls.at(-1)!;
    expect(lastCall[0]).toEqual({ query: "acme" });
    expect((lastCall[1] as { enabled: boolean }).enabled).toBe(true);

    const headings = Array.from(
      document.querySelectorAll("[cmdk-group-heading]"),
    ).map((el) => el.textContent);
    expect(headings).toEqual(["Entities", "Emails", "Files"]);

    const items = Array.from(document.querySelectorAll("[cmdk-item]")).map(
      (el) => el.textContent,
    );
    expect(items).toEqual([
      "Acme GmbHSupplier",
      "Acme invoiceJane at Acme",
      "acme.pdf",
    ]);
  });

  it("selecting a row closes the dialog and navigates to its href", async () => {
    await mount(<Omnibox debounceMs={0} />);
    await pressCtrlK();
    await typeQuery("acme");

    const row = Array.from(
      document.querySelectorAll<HTMLElement>("[cmdk-item]"),
    ).find((el) => el.textContent?.includes("Acme invoice"));
    expect(row).toBeDefined();

    await act(async () => {
      row!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith("/emails/m1");
    expect(dialog()).toBeNull();
  });

  it("shows the empty state when the server returns no results", async () => {
    useQueryMock.mockReturnValue({
      data: { results: [] },
      isError: false,
      isFetching: false,
    });
    await mount(<Omnibox debounceMs={0} />);
    await pressCtrlK();
    await typeQuery("zz");

    expect(document.body.textContent).toContain("No results.");
    expect(document.querySelectorAll("[cmdk-item]")).toHaveLength(0);
  });
});

describe("groupOmniboxResults — pure grouping contract", () => {
  it("buckets in display order and drops empty groups", () => {
    const groups = groupOmniboxResults(RESULTS);
    expect(
      groups.map((g) => ({ kind: g.kind, count: g.results.length })),
    ).toEqual([
      { kind: "entity", count: 1 },
      { kind: "email", count: 1 },
      { kind: "file", count: 1 },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Entities", "Emails", "Files"]);
    expect(groupOmniboxResults([])).toEqual([]);
  });
});
