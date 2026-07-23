// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (`/files`) — route-level fallback (snappiness plan §1).
 *
 * Paints the page's exact registry shell (the same `h-12` "Files" header bar
 * on `bg-shelf` the loaded page renders — static chrome, not data) with
 * skeleton rows where the vault listing lands, so navigation to /files shows
 * the frame instantly instead of a blank viewport while the client surface
 * hydrates and fetches.
 */

const ROW_COUNT = 6;

export default function FilesLoading(): React.ReactElement {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading files"
      className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col bg-shelf"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-rule px-4">
        <h1 className="text-sm font-semibold text-ink">Files</h1>
      </div>

      <div className="min-h-0 flex-1 p-4">
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: ROW_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading files, please wait…</span>
    </main>
  );
}
