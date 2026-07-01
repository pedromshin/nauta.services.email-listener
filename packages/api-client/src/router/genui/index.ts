/**
 * genui/index.ts — tRPC sub-router for UI generation procedures.
 *
 * Exposes:
 *   - genui.generate: POST /v1/genui/generate (spec generation pipeline)
 *   - genui.codeIslandGenerate: POST /v1/genui/code-island/generate (jailed-eval code gen, Phase 20)
 *   - genui.historyList: GET /v1/genui/history (paginated history list, STDO-05)
 *   - genui.historyById: GET /v1/genui/history/{id} (detail with specJson, STDO-06)
 *
 * Security note: all procedures in this router proxy to the FastAPI
 * email-listener service using server-side credentials only.
 * See generate.ts and history.ts for the full security contracts.
 */

import { createTRPCRouter } from "../../trpc";
import { generateProcedure } from "./generate";
import { codeIslandGenerateProcedure } from "./code-island";
import { historyByIdProcedure, historyListProcedure } from "./history";

export const genuiRouter = createTRPCRouter({
  generate: generateProcedure,
  codeIslandGenerate: codeIslandGenerateProcedure,
  historyList: historyListProcedure,
  historyById: historyByIdProcedure,
});
