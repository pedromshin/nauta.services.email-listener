/**
 * use-hover-prefetch.test.tsx — behavioral tests for the debounced,
 * deduplicated hover-prefetch hook (snappiness plan §4).
 *
 * Mirrors this codebase's zero-mock createRoot-in-jsdom convention
 * (use-is-mobile-viewport.test.ts — no `@testing-library/react` in this
 * workspace). The hook holds no React state, so timer advancement needs no
 * `act` gymnastics — only mount/unmount do.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useHoverPrefetch,
  type HoverPrefetchHandlers,
  type UseHoverPrefetchOptions,
} from "../use-hover-prefetch";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container.remove();
  vi.useRealTimers();
});

function Harness({
  prefetch,
  options,
  expose,
}: {
  readonly prefetch: (key: string) => void;
  readonly options?: UseHoverPrefetchOptions;
  readonly expose: (handlers: HoverPrefetchHandlers) => void;
}): null {
  const handlers = useHoverPrefetch(prefetch, options);
  expose(handlers);
  return null;
}

function mountHook(
  prefetch: (key: string) => void,
  options?: UseHoverPrefetchOptions,
): HoverPrefetchHandlers {
  let handlers: HoverPrefetchHandlers | null = null;
  root = createRoot(container);
  act(() => {
    root!.render(
      <Harness
        prefetch={prefetch}
        options={options}
        expose={(h) => {
          handlers = h;
        }}
      />,
    );
  });
  if (handlers === null) throw new Error("hook did not render");
  return handlers;
}

describe("useHoverPrefetch", () => {
  it("fires the prefetch once after the dwell delay", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 80 });

    handlers.begin("email-1");
    expect(prefetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(79);
    expect(prefetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith("email-1");
  });

  it("cancel() before the delay elapses suppresses the prefetch (fast mouse travel)", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 80 });

    handlers.begin("email-1");
    vi.advanceTimersByTime(40);
    handlers.cancel("email-1");
    vi.advanceTimersByTime(500);

    expect(prefetch).not.toHaveBeenCalled();
  });

  it("dedupes: a key that already fired never fires again on re-hover", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 80 });

    handlers.begin("email-1");
    vi.advanceTimersByTime(80);
    expect(prefetch).toHaveBeenCalledTimes(1);

    handlers.begin("email-1");
    vi.advanceTimersByTime(500);
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it("coalesces begin() calls while a timer for the same key is pending", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 80 });

    handlers.begin("email-1");
    vi.advanceTimersByTime(40);
    handlers.begin("email-1"); // must NOT reset or double the timer
    vi.advanceTimersByTime(40);

    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it("caps the number of distinct prefetched keys (no prefetch storms)", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 10, maxPrefetches: 2 });

    handlers.begin("a");
    vi.advanceTimersByTime(10);
    handlers.begin("b");
    vi.advanceTimersByTime(10);
    handlers.begin("c");
    vi.advanceTimersByTime(100);

    expect(prefetch).toHaveBeenCalledTimes(2);
    expect(prefetch).not.toHaveBeenCalledWith("c");
  });

  it("unmount clears pending timers — never prefetches for a dead surface", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 80 });

    handlers.begin("email-1");
    act(() => root?.unmount());
    root = null;
    vi.advanceTimersByTime(500);

    expect(prefetch).not.toHaveBeenCalled();
  });

  it("independent keys each get their own debounce timer", () => {
    const prefetch = vi.fn();
    const handlers = mountHook(prefetch, { delayMs: 80 });

    handlers.begin("a");
    vi.advanceTimersByTime(40);
    handlers.begin("b");
    handlers.cancel("a"); // cancelling a must not touch b's timer
    vi.advanceTimersByTime(80);

    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith("b");
  });
});
