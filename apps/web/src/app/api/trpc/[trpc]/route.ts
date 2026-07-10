import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@polytoken/api-client";

import { createClient } from "~/lib/supabase/server";

const createContext = async (req: NextRequest) => {
  const supabase = await createClient();
  // Server-verified identity ONLY (T-43-P3-03) — see server.ts's contract.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return createTRPCContext({
    headers: req.headers,
    user: user ? { id: user.id, email: user.email } : null,
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createContext(req),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });

export { handler as GET, handler as POST };
