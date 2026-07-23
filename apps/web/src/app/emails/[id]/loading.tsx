// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (email detail, `/emails/[id]`) — route-level fallback
 * (snappiness plan §1).
 *
 * The RSC page awaits `params` and hands the id to the client `EmailDetail`,
 * whose own skeleton only appears AFTER hydration + the first query fires.
 * This fallback covers the params-await + route-JS + hydration window with
 * the exact same skeleton frame EmailDetail's `isLoading` branch renders
 * (header bar, then the canvas zone), so the load reads as one continuous
 * assembling of the same page — never two different loading treatments.
 */
export default function EmailDetailLoading(): React.ReactElement {
  return (
    <main className="h-full">
      <div
        role="status"
        className="flex h-full flex-col"
        aria-busy="true"
        aria-label="Loading…"
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-hair px-row-x py-row-y">
          <Skeleton className="h-4 w-28 rounded-sm" />
          <Skeleton className="h-6 max-w-md flex-1 rounded-sm" />
          <Skeleton className="h-5 w-14 rounded-sm" />
          <Skeleton className="h-8 w-32 rounded-sm" />
        </div>
        <div className="min-h-0 flex-1 p-4">
          <Skeleton className="h-full w-full rounded-card" />
        </div>
        <span className="sr-only">Loading email, please wait…</span>
      </div>
    </main>
  );
}
