/**
 * tRPC server setup — simplified, no-auth.
 *
 * Mirrors the acme-os-dev pattern but strips Supabase auth: the context
 * carries only the Drizzle `db` handle, and the single exported procedure
 * (`publicProcedure`) is unauthenticated. Add auth here later if needed.
 *
 * @see https://trpc.io/docs/server/context
 */
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@polytoken/db/client";

/**
 * 1. CONTEXT
 *
 * Everything a procedure can reach while handling a request. Here that is just
 * the database handle. `headers` is accepted (and ignored) so the fetch
 * adapter call site matches the authenticated variant and is easy to extend.
 */
export const createTRPCContext = (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
    db,
  };
};

export type TRPCContext = ReturnType<typeof createTRPCContext>;

/**
 * 2. INITIALIZATION
 *
 * Connect the context and the superjson transformer (needed so `Date` columns
 * like `receivedAt` survive the network boundary intact).
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

/**
 * Create a server-side caller.
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure — the only procedure type for now.
 */
export const publicProcedure = t.procedure;
