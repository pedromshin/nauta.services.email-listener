/**
 * thread-picker.test.tsx — ThreadPickerDialog (chat email-context selection).
 * Proves the searchable picker's row content (subject + "{n} message(s) ·
 * {relative}" + snippet) and select-to-attach behavior.
 *
 * `~/trpc/react`'s `api.emails.listThreads.useQuery` is mocked as a plain
 * vi.fn (mirrors add-email-thread-popover.test.tsx). CommandDialog renders
 * through a Radix Portal on document.body, so post-open assertions query
 * document.body. jsdom lacks scrollIntoView + ResizeObserver, which cmdk calls
 * unconditionally — both polyfilled as no-ops (same as the canvas picker test).
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeThreadListItem {
  readonly key: string;
  readonly threadId: string | null;
  readonly subject: string | null;
  readonly messageCount: number;
  readonly latestReceivedAt: string;
  readonly latestSnippet: string | null;
}

let listThreadsData: { items: FakeThreadListItem[] } = { items: [] };
const useListThreadsQueryMock = vi.fn((..._args: unknown[]) => ({
  data: listThreadsData,
  isPending: false,
  isError: false,
}));

vi.mock("~/trpc/react", () => ({
  api: {
    emails: {
      listThreads: {
        useQuery: (...args: unknown[]) => useListThreadsQueryMock(...args),
      },
    },
  },
}));

import { ThreadPickerDialog } from "../thread-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    /* jsdom no-op polyfill for cmdk/Radix. */
  };
}
if (typeof globalThis.ResizeObserver === "undefined") {
  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = NoopResizeObserver as unknown as typeof ResizeObserver;
}

const THREAD_A: FakeThreadListItem = {
  key: "k1",
  threadId: "aaaaaaaa-0000-0000-0000-000000000001",
  subject: "Sua fatura BTG fechou",
  messageCount: 3,
  latestReceivedAt: "2026-07-01T11:35:00.000Z",
  latestSnippet: "Segue o resumo da sua fatura do mês.",
};
const THREAD_SINGLETON: FakeThreadListItem = {
  key: "k2",
  threadId: null, // pre-backfill singleton — excluded from the picker
  subject: "Orphan singleton",
  messageCount: 1,
  latestReceivedAt: "2026-06-01T09:00:00.000Z",
  latestSnippet: null,
};

let container: HTMLDivElement;
let root: Root;

async function mountOpen(onSelect = vi.fn()): Promise<() => void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <ThreadPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />,
    );
  });
  return onSelect;
}

beforeEach(() => {
  listThreadsData = { items: [] };
  useListThreadsQueryMock.mockClear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  document.body.querySelectorAll('[role="dialog"]').forEach((n) => n.remove());
});

describe("ThreadPickerDialog", () => {
  it("renders a searchable row per linkable thread — subject + count·time + snippet", async () => {
    listThreadsData = { items: [THREAD_A] };
    await mountOpen();

    const body = document.body.textContent ?? "";
    expect(body).toContain("Sua fatura BTG fechou");
    expect(body).toContain("3 messages");
    expect(body).toContain("Segue o resumo da sua fatura do mês.");

    // The search field is present (the whole point vs the old flat list).
    expect(
      document.body.querySelector('input[placeholder="Search your threads…"]'),
    ).not.toBeNull();
  });

  it("excludes threadId===null singletons (nothing to link)", async () => {
    listThreadsData = { items: [THREAD_A, THREAD_SINGLETON] };
    await mountOpen();

    expect(document.body.textContent).toContain("Sua fatura BTG fechou");
    expect(document.body.textContent).not.toContain("Orphan singleton");
  });

  it("selecting a row fires onSelect(threadId, subject)", async () => {
    listThreadsData = { items: [THREAD_A] };
    const onSelect = await mountOpen();

    const items = Array.from(
      document.body.querySelectorAll('[cmdk-item]'),
    ) as HTMLElement[];
    expect(items.length).toBe(1);

    await act(async () => {
      items[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      "aaaaaaaa-0000-0000-0000-000000000001",
      "Sua fatura BTG fechou",
    );
  });

  it("passes enabled:open to the threads query (closed picker costs nothing)", async () => {
    listThreadsData = { items: [THREAD_A] };
    await mountOpen();
    // The second arg carries the react-query options.
    const opts = useListThreadsQueryMock.mock.calls[0]?.[1] as
      | { enabled?: boolean }
      | undefined;
    expect(opts?.enabled).toBe(true);
  });
});
