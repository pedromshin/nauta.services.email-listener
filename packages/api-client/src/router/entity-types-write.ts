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
 * Tenancy (Phase 44, TENA-03 / T-44-06-02 / T-44-06-04): every write is
 * protectedProcedure and ownership-gated BEFORE the FastAPI proxy fetch:
 *   - A write addressed by entityTypeId/fieldId loads the owning type's
 *     importer_id. NULL importer_id = system default (migration-seeded) —
 *     WRITE-REJECTED from a user session with FORBIDDEN. A non-NULL
 *     importer_id must be owned by ctx.user (assertImporterOwnership),
 *     otherwise NOT_FOUND (fail-closed, no existence oracle vs. missing).
 *   - `create` is FORBIDDEN outright from a user session: the FastAPI
 *     endpoint only creates system-default (importer_id NULL) types
 *     (manage_entity_types.py D-26), and system defaults are seed-only.
 *
 * Spread into entityTypesRouter alongside the existing read-only `list`.
 */

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { EntityTypeFields, EntityTypes } from "@polytoken/db/schema";
import {
  assertImporterOwnership,
  type OwnershipDb,
} from "@polytoken/db/ownership";

import { protectedProcedure } from "../trpc";
import { assertOwnedOrNotFound } from "./_ownership";
import { getListenerConfig, parseErrorDetail } from "./_listener-config";

// ---------------------------------------------------------------------------
// Ownership gates (TENA-03) — run BEFORE any FastAPI proxy fetch
// ---------------------------------------------------------------------------

/**
 * assertEntityTypeWritable — the write-policy gate for an entity type row.
 *
 * - Missing type -> NOT_FOUND (fail-closed).
 * - importer_id IS NULL -> FORBIDDEN: system defaults are migration-seeded
 *   only; no user session may create/modify/delete them (T-44-06-04).
 * - importer_id non-NULL -> must be owned by the caller, else NOT_FOUND.
 */
async function assertEntityTypeWritable(
  db: OwnershipDb,
  entityTypeId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ importerId: EntityTypes.importerId })
    .from(EntityTypes)
    .where(eq(EntityTypes.id, entityTypeId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (row.importerId === null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "System-default entity types are read-only",
    });
  }
  const importerId = row.importerId;
  await assertOwnedOrNotFound(() =>
    assertImporterOwnership(db, importerId, userId),
  );
}

/**
 * assertFieldWritable — same policy as assertEntityTypeWritable, addressed
 * by an entity_type_fields id: the OWNING TYPE's importer_id governs (a
 * field on a system-default type is part of the seeded taxonomy).
 */
async function assertFieldWritable(
  db: OwnershipDb,
  fieldId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ typeImporterId: EntityTypes.importerId })
    .from(EntityTypeFields)
    .innerJoin(EntityTypes, eq(EntityTypes.id, EntityTypeFields.entityTypeId))
    .where(eq(EntityTypeFields.id, fieldId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (row.typeImporterId === null) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "System-default entity types are read-only",
    });
  }
  const importerId = row.typeImporterId;
  await assertOwnedOrNotFound(() =>
    assertImporterOwnership(db, importerId, userId),
  );
}

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
   * create — WRITE-REJECTED from user sessions (TENA-03 / T-44-06-04).
   *
   * The FastAPI POST /v1/entity-types endpoint only creates SYSTEM-DEFAULT
   * (importer_id NULL) entity types (manage_entity_types.py, D-26) — and
   * system defaults are migration-seeded only under the Phase 44 tenancy
   * contract. A user session must never mint a type visible to every other
   * user, so this procedure fails closed with FORBIDDEN before any fetch.
   * Importer-scoped type creation is a future seam (requires a FastAPI
   * endpoint that accepts an owned importer_id).
   */
  create: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        label: z.string().min(1).max(200),
        description: z.string().optional(),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Entity types cannot be created from a user session — system defaults are seed-only",
      });
    }),

  /**
   * update — update / rename / activate-deactivate an entity type (D-26).
   * PATCH {url}/v1/entity-types/{id}  body: {label?, description?, is_active?}
   */
  update: protectedProcedure
    .input(
      z.object({
        entityTypeId: z.string().uuid(),
        label: z.string().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEntityTypeWritable(ctx.db, input.entityTypeId, ctx.user.id);

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
  createField: protectedProcedure
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
    .mutation(async ({ ctx, input }) => {
      await assertEntityTypeWritable(ctx.db, input.entityTypeId, ctx.user.id);

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
  updateField: protectedProcedure
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
    .mutation(async ({ ctx, input }) => {
      await assertFieldWritable(ctx.db, input.fieldId, ctx.user.id);

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
  deleteField: protectedProcedure
    .input(z.object({ fieldId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertFieldWritable(ctx.db, input.fieldId, ctx.user.id);

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
  reorderFields: protectedProcedure
    .input(
      z.object({
        entityTypeId: z.string().uuid(),
        orderedFieldIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertEntityTypeWritable(ctx.db, input.entityTypeId, ctx.user.id);

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
