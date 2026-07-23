// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (`/references`) — route-level fallback (snappiness plan §1).
 *
 * The page's exact registry shell (the `h-12` "References" header bar on
 * `bg-shelf` — static chrome) with a save-form-shaped block up top and
 * skeleton rows where the saved references land.
 */

const ROW_COUNT = 5;

export default function ReferencesLoading(): React.ReactElement {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading references"
      className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col bg-shelf"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-rule px-4">
        <h1 className="text-sm font-semibold text-ink">References</h1>
      </div>

      <div className="min-h-0 flex-1 space-y-4 p-4" aria-hidden>
        {/* Save-form block. */}
        <Skeleton className="h-24 w-full rounded-md" />
        {/* Reference rows. */}
        <div className="space-y-2">
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading references, please wait…</span>
    </main>
  );
}
