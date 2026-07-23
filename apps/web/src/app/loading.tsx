// Explicit React import — Next's SWC automatic JSX runtime tolerates its
// absence, but vitest's classic-runtime esbuild transform needs `React` in
// scope for any suite that renders this file (documented codebase gotcha —
// see inbox-three-pane.tsx's identical note).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (inbox, `/`) — route-level fallback (snappiness plan §1).
 *
 * Before this file existed the click→first-paint gap was 100% blank: the
 * inbox page is `"use client"` and paints nothing until it has downloaded
 * route JS, hydrated, and fired its first tRPC query. This fallback paints
 * the SAME shell chrome as the loaded page — the three-pane frame at md+
 * (pane widths mirror InboxThreePane's ResizablePanel defaultSizes
 * 18/42/40), the tabbed single-pane stack below md — with Skeleton blocks
 * only where data lands, so the swap to real content is zero-shift.
 *
 * Layout identity contract: the wrapper is the page's own
 * `h-[calc(100svh-var(--app-tabbar-h))]` and the skeleton rows reuse the
 * exact block structure of InboxThreePane's `showLoading` branch. Identity
 * classes only (bg-leaf / border-hair / text-ink…) — never legacy aliases.
 */

const SKELETON_ROW_COUNT = 6;

const FILTER_LABELS = ["All", "Unread", "With entities"] as const;

function ThreadRowSkeletons(): React.ReactElement {
  return (
    <div aria-hidden>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div
          key={i}
          className="space-y-1.5 border-b border-hair px-row-x py-row-y"
        >
          <Skeleton className="h-3 w-24 rounded-sm" />
          <Skeleton className="h-4 w-56 rounded-sm" />
          <Skeleton className="h-3 w-72 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export default function InboxLoading(): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading inbox"
      className="h-[calc(100svh-var(--app-tabbar-h))]"
    >
      {/* Desktop (>=md): static mirror of the three-pane frame. */}
      <div className="hidden h-full md:flex">
        {/* Filters rail — static chrome, rendered as the real thing (it is
            not data), minus interactivity. */}
        <div className="flex h-full w-[18%] flex-col bg-leaf p-panel">
          <div className="mb-2 px-2 text-2xs font-semibold tracking-[0.07em] text-pencil uppercase">
            Filters
          </div>
          <div className="flex flex-col gap-0.5" aria-hidden>
            {FILTER_LABELS.map((label) => (
              <div
                key={label}
                className="rounded-md px-2.5 py-1.5 text-left text-sm text-faded"
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Threads list. */}
        <div className="flex h-full w-[42%] flex-col border-x border-hair bg-leaf">
          <div className="flex items-center gap-2 border-b border-hair px-4 py-3">
            <h2 className="text-base font-semibold text-ink">Inbox</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <ThreadRowSkeletons />
          </div>
        </div>

        {/* Reading preview. */}
        <div className="flex h-full min-w-0 flex-1 flex-col bg-leaf p-panel" aria-hidden>
          <Skeleton className="h-6 w-2/3 rounded-sm" />
          <div className="mt-2.5 border-b border-hair pb-3.5">
            <Skeleton className="h-3 w-1/2 rounded-sm" />
          </div>
          <div className="mt-4 max-w-[56ch] space-y-2">
            <Skeleton className="h-3.5 w-full rounded-sm" />
            <Skeleton className="h-3.5 w-11/12 rounded-sm" />
            <Skeleton className="h-3.5 w-4/5 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Mobile (<md): tab bar + list stack. */}
      <div className="flex h-full flex-col md:hidden">
        <div
          className="flex h-11 w-full items-center justify-start gap-1 border-b border-hair bg-leaf p-1"
          aria-hidden
        >
          {FILTER_LABELS.map((label) => (
            <Skeleton key={label} className="h-9 flex-1 rounded-md" />
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          <ThreadRowSkeletons />
        </div>
      </div>

      <span className="sr-only">Loading inbox, please wait…</span>
    </div>
  );
}
