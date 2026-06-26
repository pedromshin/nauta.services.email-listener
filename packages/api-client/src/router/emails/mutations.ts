/**
 * componentMutationProcedures — tRPC mutations that proxy to FastAPI
 * region-edit + relationship endpoints.
 *
 * Security contract (T-06-07 / T-09-30): EMAIL_LISTENER_API_KEY is read only
 * inside getListenerConfig() (now in ../_listener-config), which runs
 * server-side at call time. The key never appears in client-importable code
 * and is never NEXT_PUBLIC_.
 *
 * T-06-08: all mutation inputs are zod-validated before any fetch is issued.
 * T-06-10: env vars are read at call time (not module init) so Next.js build
 *          succeeds without the env vars present.
 *
 * Phase 9 (09-04) adds the relationship + review mutations:
 *   setRole / setEntityType / setFieldRelationship (PATCH /role|/entity-type|
 *   /field-relationship), autofillFields (POST /autofill-fields), denyField
 *   (POST /deny). confirmField reuses the existing confirmComponent proxy.
 */

import { z } from "zod";

import { publicProcedure } from "../../trpc";
import { getListenerConfig, parseErrorDetail } from "../_listener-config";

// ---------------------------------------------------------------------------
// Shared schema — polygon = exactly 4 [x, y] tuples, each coord in [0, 1]
// ---------------------------------------------------------------------------

const polygonSchema = z
  .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
  .length(4);

// ---------------------------------------------------------------------------
// componentMutationProcedures — plain object spread into emailsRouter
// ---------------------------------------------------------------------------

export const componentMutationProcedures = {
  /**
   * accept — flip a pending region to candidate status.
   * POST {url}/v1/components/{id}/accept  body: {}
   */
  accept: publicProcedure
    .input(z.object({ componentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/accept`,
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
        throw new Error(await parseErrorDetail(res, "accept failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * reject — flip a region to rejected status.
   * POST {url}/v1/components/{id}/reject  body: {}
   */
  reject: publicProcedure
    .input(z.object({ componentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/reject`,
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
        throw new Error(await parseErrorDetail(res, "reject failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * redraw — supersede an existing region with a newly drawn polygon.
   * POST {url}/v1/components/{id}/redraw  body: {polygon, page_index}
   */
  redraw: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        polygon: polygonSchema,
        pageIndex: z.number().int().min(0),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/redraw`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            polygon: input.polygon,
            page_index: input.pageIndex,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "redraw failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * split — supersede a region with ≥2 sub-regions drawn over it.
   * POST {url}/v1/components/{id}/split  body: {regions: [{polygon, page_index}]}
   */
  split: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        regions: z
          .array(
            z.object({
              polygon: polygonSchema,
              pageIndex: z.number().int().min(0),
            }),
          )
          .min(2),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/split`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            regions: input.regions.map((r) => ({
              polygon: r.polygon,
              page_index: r.pageIndex,
            })),
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "split failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * merge — combine ≥2 regions into one new candidate.
   * POST {url}/v1/components/merge  body: {component_ids, polygon?, page_index?}
   */
  merge: publicProcedure
    .input(
      z.object({
        componentIds: z.array(z.string().uuid()).min(2),
        polygon: polygonSchema.optional(),
        pageIndex: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(`${url}/v1/components/merge`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          component_ids: input.componentIds,
          ...(input.polygon !== undefined && { polygon: input.polygon }),
          ...(input.pageIndex !== undefined && {
            page_index: input.pageIndex,
          }),
        }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "merge failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * nest — set or clear the parent_component_id of a region.
   * POST {url}/v1/components/{id}/nest  body: {parent_component_id}
   */
  nest: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        parentComponentId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/nest`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent_component_id: input.parentComponentId,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "nest failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * createRegion — draw a new region on a page with zero prior proposals.
   * POST {url}/v1/components/{pageComponentId}/regions  body: {polygon, page_index}
   */
  createRegion: publicProcedure
    .input(
      z.object({
        pageComponentId: z.string().uuid(),
        polygon: polygonSchema,
        pageIndex: z.number().int().min(0),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.pageComponentId}/regions`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            polygon: input.polygon,
            page_index: input.pageIndex,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "createRegion failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * classifyDocument — classify a whole multi-page attachment as one entity.
   * POST {url}/v1/components/{pageComponentId}/classify-document  body: {}
   *
   * pageComponentId is any attachment_page component of the attachment; the
   * backend gathers every page and creates one candidate region whose text
   * spans the whole document. Key read server-side only; UUID validated.
   */
  classifyDocument: publicProcedure
    .input(z.object({ pageComponentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.pageComponentId}/classify-document`,
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
        throw new Error(await parseErrorDetail(res, "classify document failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  // ---------------------------------------------------------------------------
  // Phase 7 mutations — autofill / confirm / reprocess
  // ---------------------------------------------------------------------------

  /**
   * autofillComponent — trigger AI field extraction for a region component.
   * POST {url}/v1/components/{id}/autofill  body: {entity_type_slug}
   *
   * T-07-02: componentId validated as UUID before URL interpolation.
   * T-07-01: key read server-side only via getListenerConfig().
   */
  autofillComponent: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        entityTypeSlug: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/autofill`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entity_type_slug: input.entityTypeSlug }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "autofill failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * confirmComponent — persist human-confirmed field values for a component.
   * POST {url}/v1/components/{id}/confirm  body: {corrected_fields}
   *
   * T-07-02: componentId validated as UUID before URL interpolation.
   * T-07-03: correctedFields is opaque Record<string,unknown> — not eval'd or rendered here.
   */
  confirmComponent: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        correctedFields: z.record(z.unknown()).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/confirm`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ corrected_fields: input.correctedFields }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "confirm failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * reprocessEmail — supersede all existing extractions and reprocess an email.
   * POST {url}/v1/emails/{id}/reprocess  body: {}
   *
   * T-07-02: emailId validated as UUID before URL interpolation.
   * T-07-05: no per-user rate limiting (accepted risk D-18).
   */
  reprocessEmail: publicProcedure
    .input(z.object({ emailId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/emails/${input.emailId}/reprocess`,
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
        throw new Error(await parseErrorDetail(res, "reprocess failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  // ---------------------------------------------------------------------------
  // Phase 9 (09-04) — relationship + review mutations (D-15)
  //
  // T-09-31: every id is z.string().uuid() validated before URL interpolation
  //          (path-segment injection guard, 07-01 pattern).
  // T-09-32: role / fieldType allowlists enforced at the tRPC input boundary
  //          (defense-in-depth with the Pydantic validators in 09-02/03).
  // ---------------------------------------------------------------------------

  /**
   * setRole — set or clear a region's relationship role (D-10).
   * PATCH {url}/v1/components/{id}/role  body: {role}
   *
   * role=null clears the component back to unclassified/standalone (D-01).
   */
  setRole: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        role: z.enum(["entity", "field", "unrelated"]).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(`${url}/v1/components/${input.componentId}/role`, {
        method: "PATCH",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: input.role }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "setRole failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * setEntityType — set or clear an ENTITY region's entity_type_id (D-03/D-11).
   * PATCH {url}/v1/components/{id}/entity-type  body: {entity_type_id}
   *
   * entityTypeId=null clears the entity-type link.
   */
  setEntityType: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        entityTypeId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/entity-type`,
        {
          method: "PATCH",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entity_type_id: input.entityTypeId }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "setEntityType failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * setFieldRelationship — set or clear a FIELD region's parent entity +
   * property mapping together (D-04/D-11).
   * PATCH {url}/v1/components/{id}/field-relationship
   *   body: {parent_component_id, entity_type_field_id}
   *
   * Both null clears the field's parent + property link.
   */
  setFieldRelationship: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        parentComponentId: z.string().uuid().nullable(),
        entityTypeFieldId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/field-relationship`,
        {
          method: "PATCH",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent_component_id: input.parentComponentId,
            entity_type_field_id: input.entityTypeFieldId,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(
          await parseErrorDetail(res, "setFieldRelationship failed"),
        );
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * autofillFields — auto-detect + autofill the entity's sub-fields as
   * candidates (D-13/14/15/19).
   * POST {url}/v1/components/{entity_id}/autofill-fields  body: {}
   *
   * Results land as new candidate field rows server-side; the caller refetches
   * emails.detail to pick them up (no optimistic update).
   */
  autofillFields: publicProcedure
    .input(z.object({ entityComponentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.entityComponentId}/autofill-fields`,
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
        throw new Error(await parseErrorDetail(res, "autofillFields failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * denyField — deny a field box, origin-aware (D-18) + record the D-19 memo.
   * POST {url}/v1/components/{id}/deny  body: {}
   *
   * Auto-detected box → soft-reject; user-drawn box → keep geometry, clear the
   * wrong candidate value/property. The backend decides based on box origin.
   */
  denyField: publicProcedure
    .input(z.object({ componentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(`${url}/v1/components/${input.componentId}/deny`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "denyField failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * confirmField — promote a candidate field to confirmed (D-16/D-17).
   * POST {url}/v1/components/{id}/confirm  body: {corrected_fields}
   *
   * Phase-9-named alias over the existing /confirm proxy so the review loop
   * (confirm-deny-controls) reads symmetrically with denyField. correctedFields
   * is an opaque Record passed straight through (not rendered/eval'd here).
   */
  confirmField: publicProcedure
    .input(
      z.object({
        componentId: z.string().uuid(),
        correctedFields: z.record(z.unknown()).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/components/${input.componentId}/confirm`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            corrected_fields: input.correctedFields ?? null,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "confirmField failed"));
      }
      return res.json() as Promise<unknown>;
    }),
};
