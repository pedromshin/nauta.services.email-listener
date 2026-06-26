import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createCallerFactory, createTRPCContext } from "./trpc";

/**
 * Server-side caller factory for the tRPC API.
 * @example const trpc = createCaller(createTRPCContext({ headers }));
 */
const createCaller = createCallerFactory(appRouter);

/** Inference helper for input types: RouterInputs["emails"]["list"] */
type RouterInputs = inferRouterInputs<AppRouter>;

/** Inference helper for output types: RouterOutputs["emails"]["list"] */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter, createCaller };
export type { AppRouter, RouterInputs, RouterOutputs };

// Geometry utilities — used by the overlay layer in the Review UI
export { polygonToRect } from "./geometry";
