// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (`/chat`) — route-level fallback (snappiness plan §1).
 *
 * Mirrors the chat frame's geometry: the page's own
 * `h-[calc(100svh-var(--app-tabbar-h))]` budget, the `w-52` conversation
 * rail (desktop only — the mobile rail is an overlay Sheet that defaults
 * closed, so below `md` the fallback is just the column), and the single
 * `h-11` header rule the main column hangs off. Skeleton blocks stand where
 * the rail rows and header controls land.
 */

const RAIL_ROW_COUNT = 5;

export default function ChatLoading(): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading chat"
      className="flex h-[calc(100svh-var(--app-tabbar-h))] flex-col"
    >
      <div className="flex min-h-0 flex-1">
        {/* Conversation rail ghost — w-52 (RAIL_WIDTH), desktop only. */}
        <div
          className="hidden w-52 shrink-0 flex-col border-r border-hair p-2 md:flex"
          aria-hidden
        >
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: RAIL_ROW_COUNT }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </div>

        {/* Main column: the one h-11 header rule, then the body. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className="flex h-11 shrink-0 items-center gap-2 border-b border-hair px-2"
            aria-hidden
          >
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="ml-auto flex items-center gap-3">
              <Skeleton className="h-5 w-16 rounded-sm" />
            </div>
          </div>
          <div className="min-h-0 flex-1" />
        </div>
      </div>

      <span className="sr-only">Loading chat, please wait…</span>
    </div>
  );
}
