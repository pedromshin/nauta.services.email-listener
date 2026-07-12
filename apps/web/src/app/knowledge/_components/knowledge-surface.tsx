"use client";

/**
 * knowledge-surface.tsx — client wrapper that branches `/knowledge`'s
 * presentation on `useIsMobileViewport()` (53-06-PLAN.md Task 2, MOBL-01).
 *
 * `knowledge/page.tsx` is a server component (it owns `metadata`) and cannot
 * read a client hook directly — this thin wrapper is the seam. Below `md`,
 * `KnowledgeMobileList` renders and `KnowledgeGraphIsland` (the
 * `dynamic(ssr:false)` React-Flow wrapper) is never mounted, so its dynamic
 * import is never triggered — same pattern `/chat`'s `ChatCanvasIsland`
 * gating already established (53-05).
 */

import * as React from "react";

import { useIsMobileViewport } from "~/hooks/use-is-mobile-viewport";

import { KnowledgeGraphIsland } from "./knowledge-graph-island";
import { KnowledgeMobileList } from "./knowledge-mobile-list";

export function KnowledgeSurface(): React.ReactElement {
  const isMobile = useIsMobileViewport();

  if (isMobile) {
    return <KnowledgeMobileList />;
  }

  return <KnowledgeGraphIsland className="absolute inset-0" />;
}
