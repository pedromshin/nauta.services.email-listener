// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (`/capabilities`) — route-level fallback (snappiness plan §1).
 *
 * The page's exact registry shell (the `h-12` "Capabilities" header bar on
 * `bg-shelf` — static chrome) with skeletons shaped like the grouped
 * capability rows (a group label, then rows) where the registry data lands.
 */

const GROUP_COUNT = 2;
const ROWS_PER_GROUP = 3;

export default function CapabilitiesLoading(): React.ReactElement {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading capabilities"
      className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col bg-shelf"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-rule px-4">
        <h1 className="text-sm font-semibold text-ink">Capabilities</h1>
      </div>

      <div className="min-h-0 flex-1 space-y-6 p-4" aria-hidden>
        {Array.from({ length: GROUP_COUNT }, (_, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-3 w-32 rounded-sm" />
            {Array.from({ length: ROWS_PER_GROUP }, (_, row) => (
              <Skeleton key={row} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>

      <span className="sr-only">Loading capabilities, please wait…</span>
    </main>
  );
}
