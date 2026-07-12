/**
 * genui/index.ts — tRPC sub-router for UI generation procedures.
 *
 * Exposes:
 *   - genui.generate: POST /v1/genui/generate (spec generation pipeline)
 *   - genui.codeIslandGenerate: POST /v1/genui/code-island/generate (jailed-eval code gen, Phase 20)
 *   - genui.historyList: GET /v1/genui/history (paginated history list, STDO-05)
 *   - genui.historyById: GET /v1/genui/history/{id} (detail with specJson, STDO-06)
 *   - genui.resolveRetheme: POST /v1/genui/retheme (one-shot NL re-theme resolution, PANL-04/52-05)
 *   - genui.applyPanelEdit: bounded, whitelisted spec-param edit — DB-free,
 *     no FastAPI call (PANL-02/52-03)
 *
 * Security note: most procedures in this router proxy to the FastAPI
 * email-listener service using server-side credentials only (see
 * generate.ts, history.ts, retheme.ts). panel-edit.ts is the one exception —
 * it operates only on the client-supplied spec, which it fully re-validates
 * itself (FOUND-6).
 */

import { createTRPCRouter } from "../../trpc";
import { generateProcedure } from "./generate";
import { codeIslandGenerateProcedure } from "./code-island";
import { historyByIdProcedure, historyListProcedure } from "./history";
import { resolveRethemeProcedure } from "./retheme";
import { applyPanelEditProcedure } from "./panel-edit";

export const genuiRouter = createTRPCRouter({
  generate: generateProcedure,
  codeIslandGenerate: codeIslandGenerateProcedure,
  historyList: historyListProcedure,
  historyById: historyByIdProcedure,
  resolveRetheme: resolveRethemeProcedure,
  applyPanelEdit: applyPanelEditProcedure,
});
