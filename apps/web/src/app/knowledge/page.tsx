import type { Metadata } from "next";

import { KnowledgeGraphIsland } from "./_components/knowledge-graph-island";

export const metadata: Metadata = {
  title: "Knowledge — Polytoken",
  description: "Explore the entity and knowledge graph for your imported emails.",
};

/**
 * /knowledge route — server-component shell.
 *
 * The graph itself is a client island (ssr: false) loaded via
 * KnowledgeGraphIsland (a "use client" wrapper around dynamic(ssr:false)).
 *
 * Next.js 15 requires that `ssr: false` lives inside a Client Component —
 * the dynamic() call cannot be placed directly in a Server Component (D-08).
 */
export default function KnowledgePage(): React.ReactElement {
  return (
    <main className="flex h-[calc(100vh-3.5rem)] w-full flex-col">
      <div className="flex h-12 shrink-0 items-center border-b border-border/50 px-4">
        <h1 className="text-sm font-semibold text-foreground">Knowledge Graph</h1>
      </div>

      <div className="relative min-h-0 flex-1">
        <KnowledgeGraphIsland className="absolute inset-0" />
      </div>
    </main>
  );
}
