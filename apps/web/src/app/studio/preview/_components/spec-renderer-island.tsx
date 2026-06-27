"use client";

/**
 * spec-renderer-island.tsx — thin "use client" wrapper that holds the
 * `dynamic(ssr: false)` call for the SpecRenderer.
 *
 * Next.js 15 enforces that `ssr: false` is not allowed inside Server Components.
 * Moving it here (a Client Component) resolves the compile error while keeping
 * page.tsx a true server component for metadata + layout (D-08/D-20).
 *
 * Pattern mirrors knowledge-graph-island.tsx exactly.
 * loading: () => null per UI-SPEC §8 — no skeleton needed; this renders a
 * static hardcoded spec (no network request), so the flash is imperceptible.
 *
 * COMPONENT_REGISTRY is NOT passed as a prop from the server because it contains
 * Zod schema objects (class instances) that Next.js cannot serialize across the
 * server/client boundary. Instead, the island imports it directly — both
 * COMPONENT_REGISTRY and SpecRenderer are client-side modules. The SpecRenderer
 * default prop `registry = COMPONENT_REGISTRY` handles it automatically.
 */

import React from "react";
import dynamic from "next/dynamic";

import type { SpecRoot } from "@nauta/genui/schema";

const SpecRendererDynamic = dynamic(
  () =>
    import("@nauta/genui/renderer").then((mod) => ({
      default: mod.SpecRenderer,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

export interface SpecRendererIslandProps {
  readonly spec: SpecRoot;
  readonly data?: Record<string, unknown>;
}

export function SpecRendererIsland({
  spec,
  data,
}: SpecRendererIslandProps): React.ReactElement {
  // registry omitted — SpecRenderer defaults to COMPONENT_REGISTRY (NAUTA_CATALOG)
  // This avoids serializing Zod schema objects across the server/client boundary.
  return (
    <SpecRendererDynamic
      spec={spec}
      data={data}
    />
  );
}
