/**
 * merge-review-queue.test.tsx — EN-02 merge-review queue behavior.
 *
 * Harness: jsdom + createRoot + `act` from "react" — this app's real
 * convention (see vault-states.test.tsx's header; @testing-library/react is
 * not a dependency of this repo).
 *
 * The tRPC seam and sonner are faked at the module boundary. What is proved:
 *   Test 1: pairs render side-by-side — both entities' names, aliases,
 *           identifiers, occurrence counts, shared evidence, and the three
 *           actions (Merge / Reject / Skip) with labels.
 *   Test 2: Merge calls the EXISTING write path — api.entities.confirmMerge
 *           — with entityInstanceId = subject (survivor), targetId =
 *           candidate (EN-02's "reuse detail-page write paths" contract).
 *   Test 3: Reject calls the EXISTING api.entities.rejectMerge write path
 *           with the same direction contract.
 *   Test 4: Skip is local-only — hides the card, calls NO mutation.
 *   Test 5: empty queue renders the "Queue clear" state.
 *   Test 6: loading renders an aria-busy skeleton (no crash pre-data).
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const confirmMergeMutate = vi.fn();
const rejectMergeMutate = vi.fn();
const toastError = vi.fn();

let queueResult: {
  data?: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
} = { data: undefined, isLoading: true, isFetching: true, isError: false };

vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("~/trpc/react", () => ({
  api: {
    entities: {
      reviewQueue: {
        useQuery: () => queueResult,
      },
      confirmMerge: {
        useMutation: () => ({ mutate: confirmMergeMutate }),
      },
      rejectMerge: {
        useMutation: () => ({ mutate: rejectMergeMutate }),
      },
    },
    useUtils: () => ({
      entities: {
        reviewQueue: {
          cancel: vi.fn(),
          getData: vi.fn(),
          setData: vi.fn(),
          invalidate: vi.fn(),
        },
        list: { invalidate: vi.fn() },
      },
    }),
  },
}));

import { MergeReviewQueue } from "../merge-review-queue";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBJECT_ID = "60000000-0000-0000-0000-000000000e01";
const CANDIDATE_ID = "60000000-0000-0000-0000-000000000e02";

function pairFixture(overrides: Record<string, unknown> = {}) {
  return {
    pairKey: `${SUBJECT_ID}::${CANDIDATE_ID}`,
    subject: {
      id: SUBJECT_ID,
      displayName: "Acme Corp",
      entityTypeId: "70000000-0000-0000-0000-000000000001",
      entityTypeLabel: "Shipper",
      aliases: ["ACME Corporation"],
      identifiers: { email: "ops@acme.com" },
      occurrenceCount: 7,
    },
    candidate: {
      id: CANDIDATE_ID,
      displayName: "ACME Corporation",
      entityTypeId: "70000000-0000-0000-0000-000000000001",
      entityTypeLabel: "Shipper",
      aliases: [],
      identifiers: { email: "OPS@acme.com" },
      occurrenceCount: 2,
    },
    matchTypes: ["semantic"],
    maxSimilarity: 0.91,
    linkCount: 3,
    sharedAliases: ["ACME Corporation"],
    sharedIdentifierKeys: ["email"],
    ...overrides,
  };
}

function loadedQueue(items: unknown[], totalPending = items.length) {
  return {
    data: { items, hasMore: false, nextOffset: items.length, totalPending },
    isLoading: false,
    isFetching: false,
    isError: false,
  };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root | null = null;

function mount(): void {
  root = createRoot(container);
  act(() => {
    root!.render(<MergeReviewQueue />);
  });
}

function click(el: Element | null): void {
  expect(el, "expected element to click").not.toBeNull();
  act(() => {
    (el as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
}

function buttonByLabel(substring: string): HTMLButtonElement | null {
  const buttons = [...container.querySelectorAll("button")];
  return (
    buttons.find((b) =>
      (b.getAttribute("aria-label") ?? b.textContent ?? "").includes(substring),
    ) ?? null
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  confirmMergeMutate.mockReset();
  rejectMergeMutate.mockReset();
  toastError.mockReset();
  queueResult = {
    data: undefined,
    isLoading: true,
    isFetching: true,
    isError: false,
  };
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MergeReviewQueue (EN-02)", () => {
  it("Test 1: renders a pending pair side-by-side with evidence and labeled actions", () => {
    queueResult = loadedQueue([pairFixture()]);
    mount();

    const text = container.textContent ?? "";
    // Both entities' names
    expect(text).toContain("Acme Corp");
    expect(text).toContain("ACME Corporation");
    // Counts per side
    expect(text).toContain("7 emails");
    expect(text).toContain("2 emails");
    // Identifier evidence
    expect(text).toContain("ops@acme.com");
    // Shared evidence strip
    expect(text).toContain("Shared evidence");
    expect(text).toContain("same email");
    // Similarity + match type
    expect(text).toContain("91% similar");
    expect(text).toContain("semantic");
    // Pending count in the header
    expect(text).toContain("1 pair pending");
    // The three labeled actions
    expect(buttonByLabel("Merge ACME Corporation into Acme Corp")).not.toBeNull();
    expect(buttonByLabel("Reject merge")).not.toBeNull();
    expect(buttonByLabel("Skip")).not.toBeNull();
    // Evidence values carry the serif/data-evidence pairing (law 2)
    const evidence = container.querySelectorAll("[data-evidence]");
    expect(evidence.length).toBeGreaterThan(0);
  });

  it("Test 2: Merge calls the EXISTING entities.confirmMerge write path (subject survives)", () => {
    queueResult = loadedQueue([pairFixture()]);
    mount();

    click(buttonByLabel("Merge ACME Corporation into Acme Corp"));

    expect(confirmMergeMutate).toHaveBeenCalledTimes(1);
    expect(confirmMergeMutate).toHaveBeenCalledWith({
      entityInstanceId: SUBJECT_ID,
      targetId: CANDIDATE_ID,
    });
    expect(rejectMergeMutate).not.toHaveBeenCalled();
  });

  it("Test 3: Reject calls the EXISTING entities.rejectMerge write path", () => {
    queueResult = loadedQueue([pairFixture()]);
    mount();

    click(buttonByLabel("Reject merge"));

    expect(rejectMergeMutate).toHaveBeenCalledTimes(1);
    expect(rejectMergeMutate).toHaveBeenCalledWith({
      entityInstanceId: SUBJECT_ID,
      targetId: CANDIDATE_ID,
    });
    expect(confirmMergeMutate).not.toHaveBeenCalled();
  });

  it("Test 4: Skip hides the pair locally and calls NO mutation", () => {
    queueResult = loadedQueue([pairFixture()]);
    mount();

    click(buttonByLabel("Skip"));

    // Card gone from view…
    expect(container.querySelector("[data-pair-key]")).toBeNull();
    expect(container.textContent).toContain("You skipped 1 pair");
    // …but nothing was written.
    expect(confirmMergeMutate).not.toHaveBeenCalled();
    expect(rejectMergeMutate).not.toHaveBeenCalled();

    // And the skipped set is recoverable.
    click(buttonByLabel("Show skipped pairs"));
    expect(container.querySelector("[data-pair-key]")).not.toBeNull();
  });

  it("Test 5: empty queue renders the Queue clear state", () => {
    queueResult = loadedQueue([], 0);
    mount();

    expect(container.textContent).toContain("Queue clear");
    expect(container.querySelector("[data-pair-key]")).toBeNull();
  });

  it("Test 6: loading renders an aria-busy skeleton", () => {
    mount();

    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(busy?.getAttribute("aria-label")).toContain("Loading merge review");
  });
});
