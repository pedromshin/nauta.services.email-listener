"use client";

/**
 * knowledge-graph-skeleton.tsx — loading placeholder for the knowledge graph.
 *
 * Renders static animated ghost divs that approximate the graph layout:
 *   3 tall entity_type ghosts (160×48) + 5 shorter entity_type_field ghosts (128×32).
 * These are plain <div> elements — NOT React Flow nodes — to avoid SSR/canvas issues.
 *
 * UI-SPEC skeleton specification: "3 tall entity_type ghosts + 5 shorter
 * entity_type_field ghosts — static divs, not React Flow."
 */

// Entity type ghost dimensions match UI-SPEC Node Visual Language
const ENTITY_TYPE_GHOSTS = 3;
const ENTITY_TYPE_FIELD_GHOSTS = 5;

// Explicit typed ghost configs (no hardcoded magic numbers inline)
interface GhostConfig {
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly key: string;
}

const ENTITY_TYPE_CONFIGS: ReadonlyArray<GhostConfig> = Array.from(
  { length: ENTITY_TYPE_GHOSTS },
  (_, i) => ({
    key: `et-${i}`,
    width: 160,
    height: 48,
    color: "bg-primary/10",
  }),
);

const ENTITY_TYPE_FIELD_CONFIGS: ReadonlyArray<GhostConfig> = Array.from(
  { length: ENTITY_TYPE_FIELD_GHOSTS },
  (_, i) => ({
    key: `etf-${i}`,
    width: 128,
    height: 32,
    color: "bg-muted/60",
  }),
);

function Ghost({ width, height, color }: Omit<GhostConfig, "key">): React.ReactElement {
  return (
    <div
      style={{ width, height }}
      className={`${color} animate-pulse rounded-lg border border-border/40`}
      aria-hidden
    />
  );
}

/**
 * KnowledgeGraphSkeleton — static div-based loading ghost for the graph area.
 * Displayed via dynamic(ssr:false, loading: <KnowledgeGraphSkeleton />) in the
 * page. role="status" + aria-label for accessibility during loading.
 */
export function KnowledgeGraphSkeleton(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading knowledge graph"
      className="flex h-full w-full flex-col items-center justify-center gap-6"
    >
      {/* Row 1: entity_type ghosts (3 tall blocks) */}
      <div className="flex flex-row items-center justify-center gap-6">
        {ENTITY_TYPE_CONFIGS.map((cfg) => (
          <Ghost key={cfg.key} width={cfg.width} height={cfg.height} color={cfg.color} />
        ))}
      </div>

      {/* Row 2: entity_type_field ghosts (5 shorter blocks) */}
      <div className="flex flex-row flex-wrap items-center justify-center gap-4">
        {ENTITY_TYPE_FIELD_CONFIGS.map((cfg) => (
          <Ghost key={cfg.key} width={cfg.width} height={cfg.height} color={cfg.color} />
        ))}
      </div>

      {/* Visually hidden status text for screen readers */}
      <span className="sr-only">Loading knowledge graph, please wait…</span>
    </div>
  );
}
