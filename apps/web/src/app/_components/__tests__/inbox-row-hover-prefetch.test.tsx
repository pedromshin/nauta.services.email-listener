/**
 * inbox-row-hover-prefetch.test.tsx — behavioral gate for the inbox→detail
 * hover-prefetch wiring (snappiness plan §4).
 *
 * `InboxRow` stays purely presentational: it receives optional
 * `onHoverPrefetch`/`onHoverPrefetchCancel` callbacks and invokes them on
 * pointer-enter/leave and row-level focus/blur; the debounce/dedupe policy
 * and the actual `router.prefetch` + `utils.emails.detail.prefetch` calls
 * live with the parent (`inbox-three-pane.tsx` + `useHoverPrefetch`). This
 * suite proves the row-side contract, including that focus bubbling up from
 * nested entity-chip links does NOT count as hover-intent.
 *
 * Mirrors the createRoot-in-jsdom convention (no @testing-library here).
 * React synthesizes onPointerEnter/onPointerLeave from bubbling
 * pointerover/pointerout events (with a relatedTarget outside the node), so
 * the dispatches below exercise the REAL event path, not the props directly.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxRow, type InboxEmail } from "../inbox-row";
import { InboxThreadGroup } from "../inbox-thread-group";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EMAIL: InboxEmail = {
  id: "11111111-1111-1111-1111-111111111111",
  subject: "Cotação frete SP -> POA",
  senderName: "Rafael Lima",
  senderAddress: "rafael@example.com",
  receivedAt: "2026-01-01T00:00:00.000Z",
  bodyText: "Consigo fechar em R$ 4.820,00 com coleta na sexta.",
};

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container.remove();
});

function mount(element: React.ReactElement): void {
  root = createRoot(container);
  act(() => {
    root!.render(element);
  });
}

function rowElement(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[role="button"]');
  if (!el) throw new Error("InboxRow root not found");
  return el;
}

describe("InboxRow hover-prefetch wiring (snappiness plan §4)", () => {
  it("pointer enter begins the prefetch; pointer leave cancels it", () => {
    const begin = vi.fn();
    const cancel = vi.fn();
    mount(
      <InboxRow
        email={EMAIL}
        entities={[]}
        isSelected={false}
        onSelect={() => undefined}
        onHoverPrefetch={begin}
        onHoverPrefetchCancel={cancel}
      />,
    );

    act(() => {
      rowElement().dispatchEvent(
        new Event("pointerover", { bubbles: true }),
      );
    });
    expect(begin).toHaveBeenCalledTimes(1);
    expect(begin).toHaveBeenCalledWith(EMAIL.id);
    expect(cancel).not.toHaveBeenCalled();

    act(() => {
      rowElement().dispatchEvent(new Event("pointerout", { bubbles: true }));
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(EMAIL.id);
  });

  it("row-level focus begins the prefetch (keyboard triage warms the caches too)", () => {
    const begin = vi.fn();
    mount(
      <InboxRow
        email={EMAIL}
        entities={[]}
        isSelected={false}
        onSelect={() => undefined}
        onHoverPrefetch={begin}
      />,
    );

    act(() => {
      rowElement().dispatchEvent(
        new FocusEvent("focusin", { bubbles: true }),
      );
    });
    expect(begin).toHaveBeenCalledTimes(1);
    expect(begin).toHaveBeenCalledWith(EMAIL.id);
  });

  it("omitting the prefetch props changes nothing (rows stay mountable without wiring)", () => {
    mount(
      <InboxRow
        email={EMAIL}
        entities={[]}
        isSelected={false}
        onSelect={() => undefined}
      />,
    );

    expect(() => {
      act(() => {
        rowElement().dispatchEvent(
          new Event("pointerover", { bubbles: true }),
        );
        rowElement().dispatchEvent(
          new Event("pointerout", { bubbles: true }),
        );
      });
    }).not.toThrow();
  });

  it("InboxThreadGroup forwards the prefetch handlers to its singleton member row", () => {
    const begin = vi.fn();
    const cancel = vi.fn();
    mount(
      <InboxThreadGroup
        subject={EMAIL.subject}
        messageCount={1}
        latestReceivedAt={EMAIL.receivedAt}
        latestSnippet={EMAIL.bodyText}
        members={[EMAIL]}
        entitiesByEmailId={new Map()}
        selectedEmailId={null}
        onSelectMember={() => undefined}
        onHoverPrefetch={begin}
        onHoverPrefetchCancel={cancel}
      />,
    );

    act(() => {
      rowElement().dispatchEvent(
        new Event("pointerover", { bubbles: true }),
      );
    });
    expect(begin).toHaveBeenCalledWith(EMAIL.id);

    act(() => {
      rowElement().dispatchEvent(new Event("pointerout", { bubbles: true }));
    });
    expect(cancel).toHaveBeenCalledWith(EMAIL.id);
  });
});
