/**
 * generation/allowed-procedures.ts — Allowlist 2: tRPC procedure enumeration (D-13b).
 *
 * ALLOWED_PROCEDURES is the hand-curated, query-only set of tRPC procedures
 * that the LLM generator may reference in DataBinding nodes. No wildcards.
 * Expanding this list requires the allowlist-change review gate:
 *   a written threat model + tight Zod prop schema + code-review sign-off
 *   (SAFETY-PITFALLS Pitfall 4 / GR-20 / D-23).
 *
 * Initial set (D-13b):
 *   emails.list, emails.byId, emails.detail — email query procedures
 *   entities.list, entities.byId           — entity query procedures
 *   entityTypes.list                        — entity type catalog
 *   knowledge.graph, knowledge.list, knowledge.byId — knowledge graph queries
 *
 * Mutation procedures are NOT here. The mutation seam lives in action-schema.ts
 * (ALLOWED_MUTATIONS = [] as const, SEAM-02).
 */

import { z } from "zod";

/** Hand-curated, query-only tRPC procedure allowlist (D-13b). */
export const ALLOWED_PROCEDURES = [
  "emails.list",
  "emails.byId",
  "emails.detail",
  "entities.list",
  "entities.byId",
  "entityTypes.list",
  "knowledge.graph",
  "knowledge.list",
  "knowledge.byId",
] as const;

/** Inferred union type of allowed procedure string literals. */
export type AllowedProcedure = (typeof ALLOWED_PROCEDURES)[number];

/**
 * Zod schema enforcing the procedure allowlist at parse time (SAFE-03 / D-13).
 * A DataBinding referencing any procedure not in this enum fails safeParse.
 */
export const AllowedProcedureSchema: z.ZodEnum<
  [AllowedProcedure, ...AllowedProcedure[]]
> = z.enum(ALLOWED_PROCEDURES);
