/**
 * demo/index.ts — Public barrel for @polytoken/genui/demo
 *
 * Exports hand-authored demo specs for the /studio/preview route:
 *   - SHOWCASE_SPEC: generic component showcase exercising all catalog types (D-17)
 *   - MALFORMED_SPEC: error-isolation fixture with one broken node (D-18)
 *
 * Access via @polytoken/genui/demo subpath export.
 */

export { SHOWCASE_SPEC } from "./showcase-spec";
export { MALFORMED_SPEC } from "./malformed-spec";
