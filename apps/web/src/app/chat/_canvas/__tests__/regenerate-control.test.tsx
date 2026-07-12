/**
 * regenerate-control.test.tsx — RegenerateControl (PANL-03, 52-04-PLAN.md
 * Task 1, TDD): a successful mocked `genui.generate` appends a `regenerate`
 * version carrying the new specJson + the resolved pack, fires
 * `onGeneratingChange(true)` then `(false)`, and shows NO success toast; a
 * `fallback` outcome fires the exact `toast.error` copy + Retry action and
 * never calls `writeOverlay`; the derived intent is sourced from the
 * nearest preceding user message in `chat.getHistory`.
 *
 * `~/trpc/react`'s `api.genui.generate.useQuery` + `api.chat.getHistory.useQuery`
 * are mocked (no live tRPC/QueryClient mounted in this test package — mirrors
 * `edit-params-control.test.tsx`'s `applyPanelEdit` mock convention). Real
 * `createCanvasStore`/`CanvasStoreProvider`/`CanvasPersistenceProvider`
 * (mirrors `pack-switcher.test.tsx`'s zero-mock convention for the overlay
 * itself) — only `sonner`'s `toast` is mocked.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface GenerateResult {
  readonly outcome: "ok" | "fallback" | "escalated";
  readonly spec: Record<string, unknown>;
  readonly cacheHit: boolean;
  readonly reason?: string;
}

interface RefetchResult {
  readonly data?: GenerateResult;
  readonly error?: unknown;
}

let refetchImpl: () => Promise<RefetchResult> = async () => ({ data: undefined });
const refetchSpy = vi.fn(() => refetchImpl());
const generateUseQuerySpy = vi.fn(
  (_input: { intent: string; stylePackId: string }, _opts?: { enabled?: boolean }) => ({
    refetch: refetchSpy,
  }),
);

let historyRowsData: unknown[] = [];

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

vi.mock("~/trpc/react", () => ({
  api: {
    genui: {
      generate: {
        useQuery: (input: { intent: string; stylePackId: string }, opts?: { enabled?: boolean }) =>
          generateUseQuerySpy(input, opts),
      },
    },
    chat: {
      getHistory: {
        useQuery: () => ({ data: historyRowsData }),
      },
    },
  },
}));

import { TooltipProvider } from "@polytoken/ui/tooltip";

import { createCanvasStore } from "../canvas-store";
import { CanvasStoreProvider } from "../canvas-store-context";
import {
  CanvasPersistenceProvider,
  type CanvasPersistenceContextValue,
} from "../panel-overlay-context";
import { RegenerateControl, deriveIntent } from "../controls/regenerate-control";
import type { Provenance } from "../node-data-schemas";
import type { ChatHistoryRow } from "../../_hooks/use-conversation-controller";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSISTANT_MESSAGE_ID = "00000000-0000-0000-0000-0000000000b2";
const PROVENANCE: Provenance = {
  messageId: ASSISTANT_MESSAGE_ID,
  partIndex: 0,
  runId: null,
};

const CONVERSATION_ID = "11111111-1111-1111-1111-111111111111";

const USER_ROW: ChatHistoryRow = {
  id: "00000000-0000-0000-0000-0000000000a1",
  role: "user",
  parts: [{ type: "text", text: "Show top 5 open threads" }],
  status: "completed",
  turnIndex: 0,
  siblingGroupId: null,
  version: 1,
  isActive: true,
};

const ASSISTANT_ROW: ChatHistoryRow = {
  id: ASSISTANT_MESSAGE_ID,
  role: "assistant",
  parts: [{ type: "genui_spec", spec: { v: 1, root: { type: "text", content: "old" } } }],
  status: "completed",
  turnIndex: 0,
  siblingGroupId: null,
  version: 1,
  isActive: true,
};

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

function makeHarness() {
  const store = createCanvasStore();
  const persistenceValue: CanvasPersistenceContextValue = {
    scheduleSave: vi.fn(),
    conversationId: CONVERSATION_ID,
  };
  return { store, persistenceValue };
}

function overlayVersions(
  store: ReturnType<typeof createCanvasStore>,
): { generatedBy: string; specJson: string; stylePackId?: string }[] {
  const values = store.getState().values as {
    shared?: {
      panelOverlays?: Record<
        string,
        { versions?: { generatedBy: string; specJson: string; stylePackId?: string }[] }
      >;
    };
  };
  return values.shared?.panelOverlays?.["panel-a"]?.versions ?? [];
}

function renderControl(onGeneratingChange = vi.fn(), onBusyChange = vi.fn()) {
  const { store, persistenceValue } = makeHarness();
  const element = (
    <CanvasStoreProvider store={store}>
      <CanvasPersistenceProvider value={persistenceValue}>
        <TooltipProvider delayDuration={300}>
          <RegenerateControl
            panelId="panel-a"
            provenance={PROVENANCE}
            activeSpecJson={JSON.stringify({ v: 1, root: { type: "text", content: "old" } })}
            resolvedPackId="polytoken-teal"
            isLocked={false}
            onBusyChange={onBusyChange}
            onGeneratingChange={onGeneratingChange}
          />
        </TooltipProvider>
      </CanvasPersistenceProvider>
    </CanvasStoreProvider>
  );
  return { store, element };
}

beforeEach(() => {
  historyRowsData = [USER_ROW, ASSISTANT_ROW];
  generateUseQuerySpy.mockClear();
  refetchSpy.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  refetchImpl = async () => ({ data: undefined });
});

afterEach(async () => {
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  for (const c of containers) c.remove();
  containers = [];
  roots = [];
});

describe("deriveIntent", () => {
  it("returns the nearest preceding user message's text for a known assistant message", () => {
    expect(deriveIntent([USER_ROW, ASSISTANT_ROW], ASSISTANT_MESSAGE_ID)).toBe(
      "Show top 5 open threads",
    );
  });

  it("falls back to the documented directive when the message id is unknown", () => {
    expect(deriveIntent([USER_ROW, ASSISTANT_ROW], "nonexistent")).toBe(
      "Produce a fresh visual variant of this view, preserving its information and purpose.",
    );
  });

  it("falls back to the documented directive when no preceding user text exists", () => {
    expect(deriveIntent([ASSISTANT_ROW], ASSISTANT_MESSAGE_ID)).toBe(
      "Produce a fresh visual variant of this view, preserving its information and purpose.",
    );
  });
});

describe("RegenerateControl", () => {
  // Test 1
  it("a successful mocked generate appends a regenerate version, signals generating true then false, and shows no success toast", async () => {
    refetchImpl = async () => ({
      data: {
        outcome: "ok",
        spec: { v: 1, root: { type: "text", content: "new variant" } },
        cacheHit: false,
      },
    });

    const onGeneratingChange = vi.fn();
    const { store, element } = renderControl(onGeneratingChange);
    const container = await mount(element);

    expect(generateUseQuerySpy).toHaveBeenCalledWith(
      { intent: "Show top 5 open threads", stylePackId: "polytoken-teal" },
      { enabled: false },
    );

    const button = container.querySelector('[aria-label="Regenerate"]') as HTMLButtonElement;
    expect(button).not.toBeNull();

    await act(async () => {
      button.click();
    });

    expect(refetchSpy).toHaveBeenCalledTimes(1);

    const versions = overlayVersions(store);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.generatedBy).toBe("regenerate");
    expect(versions[0]?.specJson).toContain("new variant");
    expect(versions[0]?.stylePackId).toBe("polytoken-teal");

    expect(onGeneratingChange.mock.calls[0]).toEqual([true]);
    expect(onGeneratingChange).toHaveBeenLastCalledWith(false);

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  // Test 2
  it("a fallback outcome fires the exact toast.error copy with a Retry action and never calls writeOverlay", async () => {
    refetchImpl = async () => ({
      data: {
        outcome: "fallback",
        spec: { v: 1, root: { type: "text", content: "fallback content" } },
        cacheHit: false,
        reason: "The generated view could not be verified. Showing a safe fallback.",
      },
    });

    const { store, element } = renderControl();
    const container = await mount(element);

    const button = container.querySelector('[aria-label="Regenerate"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect(overlayVersions(store)).toHaveLength(0);
    expect(toastError).toHaveBeenCalledTimes(1);
    const [message, options] = toastError.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Couldn't regenerate this panel — try again.");
    expect(options.action.label).toBe("Retry");
    expect(typeof options.action.onClick).toBe("function");
  });

  // Test 3
  it("no data at all (transport failure) also fires the error toast and never calls writeOverlay", async () => {
    refetchImpl = async () => ({ data: undefined, error: new Error("network") });

    const { store, element } = renderControl();
    const container = await mount(element);

    const button = container.querySelector('[aria-label="Regenerate"]') as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect(overlayVersions(store)).toHaveLength(0);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  // Test 4
  it("the trigger is disabled while isLocked", async () => {
    const { store, persistenceValue } = makeHarness();
    const container = await mount(
      <CanvasStoreProvider store={store}>
        <CanvasPersistenceProvider value={persistenceValue}>
          <TooltipProvider delayDuration={300}>
            <RegenerateControl
              panelId="panel-a"
              provenance={PROVENANCE}
              activeSpecJson={JSON.stringify({ v: 1, root: { type: "text", content: "old" } })}
              resolvedPackId="polytoken-teal"
              isLocked={true}
              onBusyChange={vi.fn()}
              onGeneratingChange={vi.fn()}
            />
          </TooltipProvider>
        </CanvasPersistenceProvider>
      </CanvasStoreProvider>,
    );

    const button = container.querySelector('[aria-label="Regenerate"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
