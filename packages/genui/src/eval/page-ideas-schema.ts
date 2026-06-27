/**
 * eval/page-ideas-schema.ts — Shared Zod schema for page-ideas and golden-set assets.
 *
 * ONE schema validates BOTH files (D-02):
 *   - page-ideas.json: the full 76-prompt corpus superset
 *   - golden-set.json: a curated ~36-entry subset
 *
 * No AI-invented prompts — these are real corpus prompts with provenance (D-19/IDEA-01).
 */

import { z } from "zod";

/**
 * PageIdeaSchema — the entry shape shared by both page-ideas.json and golden-set.json.
 *
 * Fields mirror the REAL-PROMPT-CORPUS.md table columns:
 *   id         — corpus row number (1..76), the provenance anchor
 *   prompt     — verbatim prompt text from the corpus table (no paraphrase)
 *   category   — corpus "Category" column value
 *   complexity — corpus "Complexity" column
 *   tier       — corpus "Tier" column (A static → "A", B interactive → "B")
 *   source     — corpus "Source URL" cell verbatim (URL + [verbatim]/[paraphrased] flag)
 *   curveball  — true iff the row is in the corpus "Curveball / Weird" subset
 *
 * .strict() rejects any extra keys not in the spec (D-02).
 */
export const PageIdeaSchema = z
  .object({
    id: z.number().int().positive(),
    prompt: z.string().min(1),
    category: z.string().min(1),
    complexity: z.enum(["simple", "medium", "complex"]),
    tier: z.enum(["A", "B"]),
    source: z.string().min(1),
    curveball: z.boolean(),
  })
  .strict();

/** The full array schema — used to parse both page-ideas.json and golden-set.json. */
export const PageIdeaSetSchema = z.array(PageIdeaSchema);

/** Inferred TypeScript type from the schema (D-02: one type for both files). */
export type PageIdea = z.infer<typeof PageIdeaSchema>;
