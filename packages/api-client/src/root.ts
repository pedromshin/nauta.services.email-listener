import { emailsRouter } from "./router/emails";
import { entitiesRouter } from "./router/entities";
import { entityTypesRouter } from "./router/entity-types";
import { knowledgeRouter } from "./router/knowledge";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  emails: emailsRouter,
  entityTypes: entityTypesRouter,
  entities: entitiesRouter,
  knowledge: knowledgeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
