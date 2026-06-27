/**
 * genui/index.ts — tRPC sub-router for UI generation procedures.
 *
 * Currently exposes a single procedure: genui.generate
 *
 * Security note: all procedures in this router proxy to the FastAPI
 * email-listener service using server-side credentials only.
 * See generate.ts for the full security contract.
 */

import { createTRPCRouter } from "../../trpc";
import { generateProcedure } from "./generate";

export const genuiRouter = createTRPCRouter({
  generate: generateProcedure,
});
