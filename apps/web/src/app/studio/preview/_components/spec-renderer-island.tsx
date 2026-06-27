/**
 * Re-export from the shared studio/_components/spec-renderer-island.tsx (D-07).
 *
 * The canonical SpecRendererIsland definition lives one level up so both
 * /studio and /studio/preview share exactly ONE dynamic(ssr:false) wrapper.
 * This file is kept so existing imports in preview/page.tsx continue to resolve
 * without change.
 */
export type { SpecRendererIslandProps } from "../../_components/spec-renderer-island";
export { SpecRendererIsland } from "../../_components/spec-renderer-island";
