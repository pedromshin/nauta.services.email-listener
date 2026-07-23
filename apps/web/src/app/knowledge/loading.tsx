// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that renders this file (codebase gotcha).
import * as React from "react";

import { KnowledgeGraphSkeleton } from "./_components/knowledge-graph-skeleton";

/**
 * loading.tsx (`/knowledge`) — route-level fallback (snappiness plan §1).
 *
 * Reuses the surface's own KnowledgeGraphSkeleton (the ghost the
 * `dynamic(ssr:false)` island already shows) inside the page's exact shell
 * frame, so the route-transition fallback and the island-loading state are
 * the SAME picture — the navigation gap stops being blank without
 * introducing a second, different loading treatment.
 */
export default function KnowledgeLoading(): React.ReactElement {
  return (
    <main
      aria-busy="true"
      className="flex h-[calc(100vh-3.5rem)] w-full flex-col"
    >
      <div className="relative min-h-0 flex-1">
        <KnowledgeGraphSkeleton />
      </div>
    </main>
  );
}
