/**
 * @polytoken/ui/treemap — the shared WizTree-style rectangular landscape
 * primitive that REPLACES the circle-pack view (the emails "Landscape" tab, the
 * canvas "Mailbox / Drive landscape" node, the /files drive view all consume
 * THIS). Layout math (`layoutTreemap`) is exported alongside the React `Treemap`
 * component so consumers and their tests can reach the pure pieces without
 * rendering. The zoom/keyboard/gesture behaviour is reused verbatim from the
 * circle-pack primitive's pure state machine — one implementation, two shapes.
 */

export { Treemap } from "./treemap";
export type {
  TreemapProps,
  TreemapLeafRenderArgs,
} from "./treemap";
export {
  layoutTreemap,
  indexTree,
  type TreeNode,
  type PackedRect,
  type TreemapIndex,
  type TreemapOptions,
} from "./treemap-layout";
