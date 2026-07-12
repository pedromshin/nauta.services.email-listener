import type { Metadata } from "next";

import { KnowledgeSurface } from "./_components/knowledge-surface";

export const metadata: Metadata = {
  title: "Your knowledge — Polytoken",
  description: "Explore the entity and knowledge graph for your imported emails.",
};

/**
 * /knowledge route — server-component shell.
 *
 * `KnowledgeSurface` (a "use client" wrapper) branches the presentation on
 * `useIsMobileViewport()` (53-06-PLAN.md, MOBL-01): below `md` it renders
 * `KnowledgeMobileList`; at/above `md` it renders `KnowledgeGraphIsland`,
 * the client island (ssr: false) React-Flow graph.
 *
 * Next.js 15 requires that `ssr: false` lives inside a Client Component —
 * the dynamic() call cannot be placed directly in a Server Component (D-08).
 * page.tsx itself stays a true server component for metadata + layout.
 */
export default function KnowledgePage(): React.ReactElement {
  return (
    <main className="flex h-[calc(100vh-3.5rem)] w-full flex-col">
      <div className="flex h-12 shrink-0 items-center border-b border-border/50 px-4">
        <h1 className="text-sm font-semibold text-foreground">Knowledge Graph</h1>
      </div>

      <div className="relative min-h-0 flex-1">
        <KnowledgeSurface />
      </div>
    </main>
  );
}
