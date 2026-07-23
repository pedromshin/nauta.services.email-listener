"use client";

/**
 * use-hover-prefetch.ts — debounced, deduplicated hover/focus prefetch
 * (snappiness plan §4).
 *
 * The inbox→email-detail transition is the app's highest-frequency
 * navigation, and it is cold on both caches today: the route JS/RSC payload
 * AND the tRPC detail data are fetched only after the click. This hook lets
 * a list surface warm both on `pointerenter`/`focus`, so by the time the
 * user clicks, the critical path is (near-)zero network.
 *
 * Guard rails, per the plan:
 *   - DEBOUNCE (~80 ms default): fast mouse travel across many rows must not
 *     fire a prefetch per row — a prefetch only fires if the pointer is
 *     still "interested" when the timer elapses. `cancel()` (wired to
 *     `pointerleave`/`blur`) clears the pending timer.
 *   - DEDUPE: each key prefetches at most once per hook instance —
 *     re-hovering a row never re-fires (the router/TanStack caches hold the
 *     result anyway).
 *   - CAP (`maxPrefetches`, default 30): an upper bound on how many distinct
 *     keys one surface may warm, so a long scroll-and-hover session cannot
 *     turn into an unbounded prefetch storm.
 *
 * The hook is transport-agnostic: callers pass the actual prefetch work
 * (e.g. `router.prefetch(...)` + `utils.emails.detail.prefetch(...)`), keyed
 * by any string.
 */

import { useCallback, useEffect, useRef } from "react";

export interface UseHoverPrefetchOptions {
  /** Hover dwell time before the prefetch fires. Default 80 ms. */
  readonly delayMs?: number;
  /** Max distinct keys ever prefetched by this hook instance. Default 30. */
  readonly maxPrefetches?: number;
}

export interface HoverPrefetchHandlers {
  /** Arm the debounce timer for `key` (call on pointerenter/focus). */
  readonly begin: (key: string) => void;
  /** Cancel a still-pending timer for `key` (call on pointerleave/blur).
   * A prefetch that already fired is not undone — there is nothing to undo. */
  readonly cancel: (key: string) => void;
}

const DEFAULT_DELAY_MS = 80;
const DEFAULT_MAX_PREFETCHES = 30;

export function useHoverPrefetch(
  prefetch: (key: string) => void,
  {
    delayMs = DEFAULT_DELAY_MS,
    maxPrefetches = DEFAULT_MAX_PREFETCHES,
  }: UseHoverPrefetchOptions = {},
): HoverPrefetchHandlers {
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const firedRef = useRef(new Set<string>());
  // Latest-callback ref so `begin`/`cancel` stay referentially stable even
  // when the caller passes an inline closure every render.
  const prefetchRef = useRef(prefetch);
  prefetchRef.current = prefetch;

  // Clear every pending timer on unmount — a fired timer must never call
  // into a prefetch closure for an unmounted surface.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const begin = useCallback(
    (key: string) => {
      if (firedRef.current.has(key)) return;
      if (firedRef.current.size >= maxPrefetches) return;
      if (timersRef.current.has(key)) return;
      const timer = setTimeout(() => {
        timersRef.current.delete(key);
        if (firedRef.current.has(key)) return;
        if (firedRef.current.size >= maxPrefetches) return;
        firedRef.current.add(key);
        prefetchRef.current(key);
      }, delayMs);
      timersRef.current.set(key, timer);
    },
    [delayMs, maxPrefetches],
  );

  const cancel = useCallback((key: string) => {
    const timer = timersRef.current.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
  }, []);

  return { begin, cancel };
}
