/**
 * knowledge/index.ts — compose the knowledge tRPC router.
 *
 * Spreads graph, list, and detail procedure objects into one
 * knowledgeRouter, following the same pattern as entities/index.ts.
 */

import { createTRPCRouter } from "../../trpc";
import { knowledgeDetailProcedures } from "./detail";
import { knowledgeGraphProcedures } from "./graph";
import { knowledgeListProcedures } from "./list";

export const knowledgeRouter = createTRPCRouter({
  ...knowledgeGraphProcedures,
  ...knowledgeListProcedures,
  ...knowledgeDetailProcedures,
});
