// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * Route-level loading fallback for /entities/review (EN-02).
 *
 * Provider-free by contract (snappiness plan §1): a loading.tsx renders
 * BEFORE any client context exists. Reproduces the queue page's frame —
 * header rule, then a stack of pair-card ghosts — so the skeleton→page swap
 * is zero-shift.
 */
export default function Loading() {
  return (
    <output
      aria-busy="true"
      aria-label="Loading merge review"
      className="block h-[calc(100svh-var(--app-tabbar-h))] w-full overflow-hidden"
    >
      <div className="flex items-center gap-4 border-b border-border/50 px-6 py-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      <div className="space-y-4 p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </output>
  );
}
