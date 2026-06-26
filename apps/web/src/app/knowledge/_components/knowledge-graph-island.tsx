"use client";

/**
 * knowledge-graph-island.tsx — thin "use client" wrapper that holds the
 * `dynamic(ssr: false)` call for the React Flow knowledge graph.
 *
 * Next.js 15 enforces that `ssr: false` is not allowed inside Server Components.
 * Moving it here (a Client Component) resolves the compile error while keeping
 * the page.tsx a true server component for metadata + layout (D-08).
 *
 * Usage: import { KnowledgeGraphIsland } from "./_components/knowledge-graph-island"
 *        and drop <KnowledgeGraphIsland /> into the page.
 */

import dynamic from "next/dynamic";

import { KnowledgeGraphSkeleton } from "./knowledge-graph-skeleton";

const KnowledgeGraphDynamic = dynamic(
  () =>
    import("./knowledge-graph").then((mod) => ({
      default: mod.KnowledgeGraph,
    })),
  {
    ssr: false,
    loading: () => <KnowledgeGraphSkeleton />,
  },
);

interface KnowledgeGraphIslandProps {
  readonly className?: string;
}

export function KnowledgeGraphIsland({
  className,
}: KnowledgeGraphIslandProps): React.ReactElement {
  return <KnowledgeGraphDynamic className={className} />;
}
