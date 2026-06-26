/**
 * entityTypesWriteProcedures — entity-type + field write mutations (D-26).
 *
 * These proxy the new FastAPI /v1/entity-types CRUD endpoints (09-03) through
 * the shared getListenerConfig server-side guard. The browser never holds
 * EMAIL_LISTENER_API_KEY (T-09-30); every id is z.string().uuid() validated
 * before URL interpolation (T-09-31); field_type is constrained to the allowed
 * JSON-Schema set at the Zod boundary (T-09-32, mirrors the Pydantic validator
 * in 09-03 — defense in depth).
 *
 * Spread into entityTypesRouter alongside the existing read-only `list`.
 */

import { z } from "zod";

import { publicProcedure } from "../trpc";
import { getListenerConfig, parseErrorDetail } from "./_listener-config";

// ---------------------------------------------------------------------------
// field_type allowlist (D-27) — keep in sync with ALLOWED_FIELD_TYPES (09-03)
// ---------------------------------------------------------------------------

const fieldTypeSchema = z.enum([
  "string",
  "number",
  "date",
  "array",
  "object",
]);

// ---------------------------------------------------------------------------
// entityTypesWriteProcedures — plain object spread into entityTypesRouter
// ---------------------------------------------------------------------------

export const entityTypesWriteProcedures = {
  /**
   * create — create a system-default entity type (D-26).
   * POST {url}/v1/entity-types  body: {slug, label, description?}
   */
  create: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        label: z.string().min(1).max(200),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(`${url}/v1/entity-types`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: input.slug,
          label: input.label,
          ...(input.description !== undefined && {
            description: input.description,
          }),
        }),
      });
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "create entity type failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * update — update / rename / activate-deactivate an entity type (D-26).
   * PATCH {url}/v1/entity-types/{id}  body: {label?, description?, is_active?}
   */
  update: publicProcedure
    .input(
      z.object({
        entityTypeId: z.string().uuid(),
        label: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-types/${input.entityTypeId}`,
        {
          method: "PATCH",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(input.label !== undefined && { label: input.label }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
            ...(input.isActive !== undefined && { is_active: input.isActive }),
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "update entity type failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * createField — create a field on an entity type (D-25/D-27).
   * POST {url}/v1/entity-types/{id}/fields
   *   body: {slug, label, field_type, is_required?, sort_order?, is_identifier?, description?}
   */
  createField: publicProcedure
    .input(
      z.object({
        entityTypeId: z.string().uuid(),
        slug: z.string().min(1).max(100),
        label: z.string().min(1).max(200),
        fieldType: fieldTypeSchema,
        isRequired: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isIdentifier: z.boolean().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-types/${input.entityTypeId}/fields`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: input.slug,
            label: input.label,
            field_type: input.fieldType,
            ...(input.isRequired !== undefined && {
              is_required: input.isRequired,
            }),
            ...(input.sortOrder !== undefined && {
              sort_order: input.sortOrder,
            }),
            ...(input.isIdentifier !== undefined && {
              is_identifier: input.isIdentifier,
            }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "create field failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * updateField — update a field's attributes (D-25/D-27).
   * PATCH {url}/v1/entity-types/fields/{id}
   *   body: snake_cased subset of {slug, label, field_type, is_required, sort_order, is_identifier, description}
   */
  updateField: publicProcedure
    .input(
      z.object({
        fieldId: z.string().uuid(),
        slug: z.string().min(1).max(100).optional(),
        label: z.string().min(1).max(200).optional(),
        fieldType: fieldTypeSchema.optional(),
        isRequired: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        isIdentifier: z.boolean().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-types/fields/${input.fieldId}`,
        {
          method: "PATCH",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(input.slug !== undefined && { slug: input.slug }),
            ...(input.label !== undefined && { label: input.label }),
            ...(input.fieldType !== undefined && {
              field_type: input.fieldType,
            }),
            ...(input.isRequired !== undefined && {
              is_required: input.isRequired,
            }),
            ...(input.sortOrder !== undefined && {
              sort_order: input.sortOrder,
            }),
            ...(input.isIdentifier !== undefined && {
              is_identifier: input.isIdentifier,
            }),
            ...(input.description !== undefined && {
              description: input.description,
            }),
          }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "update field failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * deleteField — delete a field, guarded (D-27).
   * DELETE {url}/v1/entity-types/fields/{id}
   *
   * The backend soft-deactivates instead of hard-deleting when a confirmed
   * component still references the field; the response surfaces which path was
   * taken (hard_deleted / soft_deactivated) so the UI can message the outcome.
   */
  deleteField: publicProcedure
    .input(z.object({ fieldId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-types/fields/${input.fieldId}`,
        {
          method: "DELETE",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "delete field failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  /**
   * reorderFields — reorder an entity type's fields (sort_order = position).
   * POST {url}/v1/entity-types/{id}/fields/reorder  body: {ordered_field_ids}
   */
  reorderFields: publicProcedure
    .input(
      z.object({
        entityTypeId: z.string().uuid(),
        orderedFieldIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-types/${input.entityTypeId}/fields/reorder`,
        {
          method: "POST",
          headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ordered_field_ids: input.orderedFieldIds }),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "reorder fields failed"));
      }
      return res.json() as Promise<unknown>;
    }),
};
