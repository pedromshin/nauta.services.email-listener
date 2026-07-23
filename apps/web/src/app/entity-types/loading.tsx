// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { Skeleton } from "@polytoken/ui/skeleton";

/**
 * loading.tsx (`/entity-types`) — route-level fallback (snappiness plan §1).
 *
 * Mirrors the page's master/detail frame exactly — same
 * `h-[calc(100svh-var(--app-tabbar-h))]` budget, same `md:w-72` master rail
 * with its `h-11` "Entity types" header, same `h-10` list-row skeletons the
 * page's own `isLoading` branch renders — so the route transition paints the
 * frame instantly and the loaded page swaps in without shift. The class
 * vocabulary intentionally matches the page it stands in for (which still
 * uses the pre-sweep aliases), because layout identity with THAT page is the
 * contract here.
 */
export default function EntityTypesLoading(): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading entity types"
      className="flex h-[calc(100svh-var(--app-tabbar-h))]"
    >
      {/* Master list rail. */}
      <aside className="flex w-full flex-col border-border/50 md:w-72 md:shrink-0 md:border-r">
        <div className="flex h-11 items-center justify-between border-b border-border/50 bg-background/95 px-3">
          <span className="text-sm font-semibold">Entity types</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2" aria-hidden>
          <div className="space-y-2 p-1">
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
          </div>
        </div>
      </aside>

      {/* Detail pane — hidden below md (the mobile master list is the
          visible layer), the flexible pane at md+. */}
      <section
        className="hidden min-w-0 flex-1 flex-col overflow-hidden md:flex"
        aria-hidden
      >
        <div className="space-y-3 p-4">
          <Skeleton className="h-6 w-56 rounded-sm" />
          <Skeleton className="h-4 w-80 rounded-sm" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      </section>

      <span className="sr-only">Loading entity types, please wait…</span>
    </div>
  );
}
