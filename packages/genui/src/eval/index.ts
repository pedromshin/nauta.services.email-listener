/**
 * eval/index.ts — Public re-exports for @nauta/genui/eval subpath.
 *
 * Exports the shared Zod schema + inferred type, plus typed JSON constants
 * for the two committed eval assets:
 *   - PAGE_IDEAS: all 76 real corpus prompts (superset, D-19/IDEA-01)
 *   - GOLDEN_SET: curated ~36-entry subset for the eval runner (EVAL-04)
 *
 * Both assets share ONE schema (D-02: page-ideas-schema.ts).
 * No AI-invented prompts — provenance is preserved verbatim (D-19).
 */

export { PageIdeaSchema, PageIdeaSetSchema } from "./page-ideas-schema";
export type { PageIdea } from "./page-ideas-schema";

import pageIdeasJson from "./page-ideas.json";
import goldenSetJson from "./golden-set.json";
import type { PageIdea } from "./page-ideas-schema";

/**
 * All 76 real corpus prompts with verbatim provenance.
 * Typed as readonly — never mutate this at runtime.
 */
export const PAGE_IDEAS: readonly PageIdea[] = pageIdeasJson as PageIdea[];

/**
 * Curated ~36-entry subset of PAGE_IDEAS, satisfying D-03 coverage quotas:
 *   >= 10 Tier-A, >= 20 Tier-B, all 8 curveballs, >= 1 per category,
 *   balanced across simple/medium/complex.
 */
export const GOLDEN_SET: readonly PageIdea[] = goldenSetJson as PageIdea[];
