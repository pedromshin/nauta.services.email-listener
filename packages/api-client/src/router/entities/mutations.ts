/**
 * entities/mutations.ts — tRPC mutations that proxy entity-resolution
 * operations (confirmMerge, rejectMerge, unmerge) to the FastAPI service.
 *
 * Security contract (T-10-30 / D-21):
 *   EMAIL_LISTENER_API_KEY is read ONLY inside getListenerConfig() at
 *   call time. The key never appears in client-importable code and is
 *   never NEXT_PUBLIC_.
 *
 * T-06-08: all mutation inputs are zod-validated before any fetch is issued.
 * T-06-10: env vars are read at call time (not module init) so the Next.js
 *          build succeeds without the env vars present.
 *
 * Endpoint paths from 10-UI-SPEC / 10-03:
 *   POST /v1/entity-instances/{id}/merge/{targetId}/confirm
 *   POST /v1/entity-instances/{id}/merge/{targetId}/reject
 *   POST /v1/entity-instances/{id}/unmerge
 */

import { z } from "zod";

import { publicProcedure } from "../../trpc";
import { getListenerConfig, parseErrorDetail } from "../_listener-config";

export const entityMutationProcedures = {
  /**
   * confirmMerge — mark two entity instances as confirmed duplicates.
   * The entity at entityInstanceId is merged INTO targetId (or vice-versa —
   * the FastAPI service decides survivor based on its merge policy).
   *
   * POST /v1/entity-instances/{entityInstanceId}/merge/{targetId}/confirm
   */
  confirmMerge: publicProcedure
    .input(
      z.object({
        entityInstanceId: z.string().uuid(),
        targetId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-instances/${input.entityInstanceId}/merge/${input.targetId}/confirm`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "confirmMerge failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * rejectMerge — dismiss a duplicate suggestion between two entity instances.
   * Prevents the pair from being re-suggested by the RRF resolver (D-21).
   *
   * POST /v1/entity-instances/{entityInstanceId}/merge/{targetId}/reject
   */
  rejectMerge: publicProcedure
    .input(
      z.object({
        entityInstanceId: z.string().uuid(),
        targetId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-instances/${input.entityInstanceId}/merge/${input.targetId}/reject`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "rejectMerge failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * unmerge — split a previously confirmed merge back into two separate
   * entity instances (D-20 Unmerge affordance, shown when wasMerged=true).
   *
   * POST /v1/entity-instances/{entityInstanceId}/unmerge
   */
  unmerge: publicProcedure
    .input(
      z.object({
        entityInstanceId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-instances/${input.entityInstanceId}/unmerge`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "unmerge failed"));
      }
      return res.json() as Promise<unknown>;
    }),
};
