"use client";

/**
 * canvas-skeleton.tsx — loading placeholder for the /chat canvas island.
 *
 * Renders two static animated ghost divs (320x240 each, chat-node-shaped +
 * genui-panel-shaped, offset side by side) — plain <div> elements, NOT React
 * Flow nodes, same technique as /knowledge's KnowledgeGraphSkeleton, to
 * avoid SSR/canvas issues while `dynamic(ssr:false)` loads the real surface.
 */

const GHOST_WIDTH = 320;
const GHOST_HEIGHT = 240;

interface GhostConfig {
  readonly key: string;
  readonly color: string;
}

const GHOST_CONFIGS: ReadonlyArray<GhostConfig> = [
  { key: "chat-ghost", color: "bg-primary/10" },
  { key: "genui-ghost", color: "bg-muted/60" },
];

function Ghost({ color }: Omit<GhostConfig, "key">): React.ReactElement {
  return (
    <div
      style={{ width: GHOST_WIDTH, height: GHOST_HEIGHT }}
      className={`${color} animate-pulse rounded-lg border border-border/40`}
      aria-hidden
    />
  );
}

/**
 * CanvasSkeleton — displayed via
 * `dynamic(ssr:false, loading: () => <CanvasSkeleton/>)` in
 * chat-canvas-island.tsx. `role="status"` + `aria-label` for accessibility
 * during loading (23-UI-SPEC.md Copywriting Contract).
 */
export function CanvasSkeleton(): React.ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading canvas"
      className="flex h-full w-full flex-row items-center justify-center gap-6"
    >
      {GHOST_CONFIGS.map((cfg) => (
        <Ghost key={cfg.key} color={cfg.color} />
      ))}
      <span className="sr-only">Loading canvas, please wait…</span>
    </div>
  );
}
