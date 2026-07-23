/**
 * entities/index.ts — compose the entities tRPC router.
 *
 * Spreads gallery, detail, mutation, and review procedure objects into one
 * entitiesRouter, following the same pattern as emails/index.ts.
 */

import { createTRPCRouter } from "../../trpc";
import { entityDetailProcedures } from "./detail";
import { entityGalleryProcedures } from "./gallery";
import { entityMutationProcedures } from "./mutations";
import { entityReviewProcedures } from "./review";

export const entitiesRouter = createTRPCRouter({
  ...entityGalleryProcedures,
  ...entityDetailProcedures,
  ...entityMutationProcedures,
  ...entityReviewProcedures,
});
