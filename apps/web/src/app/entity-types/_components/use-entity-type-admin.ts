"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/**
 * The cache-key input the management page uses for `entityTypes.list`. All
 * optimistic snapshot/revert targets this exact key so getData/setData/cancel
 * hit the same query the page renders (D-26).
 */
const LIST_INPUT = { includeInactive: true } as const;

/** field_type allowlist (D-27) — mirrors the Zod enum in entity-types-write.ts. */
export type FieldType = "string" | "number" | "date" | "array" | "object";

/** Outcome of a deleteField call — surfaces the D-27 guard to the caller. */
export interface DeleteFieldOutcome {
  readonly fieldId: string;
  readonly hardDeleted: boolean;
  readonly softDeactivated: boolean;
}

/** Shape of the FastAPI DeleteFieldView envelope (proxied through tRPC). */
interface DeleteFieldResponse {
  readonly data?: {
    readonly field_id?: string;
    readonly hard_deleted?: boolean;
    readonly soft_deactivated?: boolean;
  };
}

export interface CreateTypeInput {
  readonly slug: string;
  readonly label: string;
  readonly description?: string;
}

export interface UpdateTypeInput {
  readonly entityTypeId: string;
  readonly label?: string;
  readonly description?: string | null;
  readonly isActive?: boolean;
}

export interface CreateFieldInput {
  readonly entityTypeId: string;
  readonly slug: string;
  readonly label: string;
  readonly fieldType: FieldType;
  readonly isRequired?: boolean;
  readonly sortOrder?: number;
  readonly isIdentifier?: boolean;
  readonly description?: string;
}

export interface UpdateFieldInput {
  readonly fieldId: string;
  readonly entityTypeId: string;
  readonly slug?: string;
  readonly label?: string;
  readonly fieldType?: FieldType;
  readonly isRequired?: boolean;
  readonly sortOrder?: number;
  readonly isIdentifier?: boolean;
  readonly description?: string | null;
}

/** All handlers + in-flight state owned by the entity-type management feature. */
export interface EntityTypeAdminState {
  createType: (input: CreateTypeInput) => void;
  updateType: (input: UpdateTypeInput) => void;
  createField: (input: CreateFieldInput) => void;
  updateField: (input: UpdateFieldInput) => void;
  /** Resolves to the guard outcome (hard-delete vs soft-deactivate) — D-27. */
  deleteField: (input: {
    readonly fieldId: string;
    readonly entityTypeId: string;
  }) => Promise<DeleteFieldOutcome>;
  reorderFields: (input: {
    readonly entityTypeId: string;
    readonly orderedFieldIds: readonly string[];
  }) => void;
  /** Entity-type ids with an in-flight type-level mutation (disable controls). */
  readonly mutatingTypeIds: readonly string[];
  /** Field ids with an in-flight field-level mutation (disable controls). */
  readonly mutatingFieldIds: readonly string[];
}

interface UseEntityTypeAdminParams {
  /** Optional: select a freshly created type once the list refetches. */
  readonly onTypeCreated?: () => void;
}

export function useEntityTypeAdmin(
  params: UseEntityTypeAdminParams = {},
): EntityTypeAdminState {
  const { onTypeCreated } = params;
  const utils = api.useUtils();

  // Field ids currently being deleted — tracked locally because the delete
  // handler is promise-based (awaited by the dialog) rather than a fire-and-
  // forget mutation, so we cannot derive its pending state from variables.
  const [deletingFieldIds, setDeletingFieldIds] = useState<readonly string[]>(
    [],
  );

  async function refetchList(): Promise<void> {
    await utils.entityTypes.list.invalidate(LIST_INPUT);
  }

  // ---- Type-level mutations ----

  const createTypeMutation = api.entityTypes.create.useMutation({
    onSuccess: async () => {
      await refetchList();
      toast.success("Entity type created");
      onTypeCreated?.();
    },
    onError: () => {
      toast.error("The entity type could not be created. Try again.");
    },
  });

  const updateTypeMutation = api.entityTypes.update.useMutation({
    // Optimistic: patch the matching type in the cached list immediately.
    onMutate: async (vars) => {
      await utils.entityTypes.list.cancel(LIST_INPUT);
      const prevData = utils.entityTypes.list.getData(LIST_INPUT);
      utils.entityTypes.list.setData(LIST_INPUT, (prev) => {
        if (!prev) return prev;
        return prev.map((t) =>
          t.id === vars.entityTypeId
            ? {
                ...t,
                ...(vars.label !== undefined && { label: vars.label }),
                ...(vars.description !== undefined && {
                  description: vars.description,
                }),
                ...(vars.isActive !== undefined && { isActive: vars.isActive }),
              }
            : t,
        );
      });
      return { prevData };
    },
    onSuccess: async () => {
      await refetchList();
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.entityTypes.list.setData(LIST_INPUT, context.prevData);
      }
      toast.error("Your changes could not be saved. Try again.");
    },
  });

  // ---- Field-level mutations ----

  const createFieldMutation = api.entityTypes.createField.useMutation({
    onSuccess: async () => {
      await refetchList();
      toast.success("Field added");
    },
    onError: () => {
      toast.error("The field could not be added. Try again.");
    },
  });

  const updateFieldMutation = api.entityTypes.updateField.useMutation({
    // Optimistic: patch the matching field inside its parent type's fields[].
    onMutate: async (vars) => {
      await utils.entityTypes.list.cancel(LIST_INPUT);
      const prevData = utils.entityTypes.list.getData(LIST_INPUT);
      utils.entityTypes.list.setData(LIST_INPUT, (prev) => {
        if (!prev) return prev;
        return prev.map((t) => ({
          ...t,
          fields: t.fields.map((f) =>
            f.id === vars.fieldId
              ? {
                  ...f,
                  ...(vars.slug !== undefined && { key: vars.slug }),
                  ...(vars.label !== undefined && { label: vars.label }),
                  ...(vars.fieldType !== undefined && {
                    dataType: vars.fieldType,
                  }),
                  ...(vars.isRequired !== undefined && {
                    isRequired: vars.isRequired,
                  }),
                  ...(vars.sortOrder !== undefined && {
                    sortOrder: vars.sortOrder,
                  }),
                  ...(vars.isIdentifier !== undefined && {
                    isIdentifier: vars.isIdentifier,
                  }),
                }
              : f,
          ),
        }));
      });
      return { prevData };
    },
    onSuccess: async () => {
      await refetchList();
      toast.success("Field updated");
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.entityTypes.list.setData(LIST_INPUT, context.prevData);
      }
      toast.error("The field could not be saved. Try again.");
    },
  });

  const deleteFieldMutation = api.entityTypes.deleteField.useMutation();

  const reorderFieldsMutation = api.entityTypes.reorderFields.useMutation({
    // Optimistic: reorder the cached fields to match the requested id order.
    onMutate: async (vars) => {
      await utils.entityTypes.list.cancel(LIST_INPUT);
      const prevData = utils.entityTypes.list.getData(LIST_INPUT);
      utils.entityTypes.list.setData(LIST_INPUT, (prev) => {
        if (!prev) return prev;
        return prev.map((t) => {
          if (t.id !== vars.entityTypeId) return t;
          const byId = new Map(t.fields.map((f) => [f.id, f]));
          const reordered = vars.orderedFieldIds
            .map((id, index) => {
              const f = byId.get(id);
              return f ? { ...f, sortOrder: index } : null;
            })
            .filter((f): f is NonNullable<typeof f> => f !== null);
          return { ...t, fields: reordered };
        });
      });
      return { prevData };
    },
    onSuccess: async () => {
      await refetchList();
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.entityTypes.list.setData(LIST_INPUT, context.prevData);
      }
      toast.error("The fields could not be reordered. Try again.");
    },
  });

  // ---- Public handlers ----

  function createType(input: CreateTypeInput): void {
    createTypeMutation.mutate({
      slug: input.slug,
      label: input.label,
      ...(input.description !== undefined && { description: input.description }),
    });
  }

  function updateType(input: UpdateTypeInput): void {
    updateTypeMutation.mutate({
      entityTypeId: input.entityTypeId,
      ...(input.label !== undefined && { label: input.label }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }

  function createField(input: CreateFieldInput): void {
    createFieldMutation.mutate({
      entityTypeId: input.entityTypeId,
      slug: input.slug,
      label: input.label,
      fieldType: input.fieldType,
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isIdentifier !== undefined && {
        isIdentifier: input.isIdentifier,
      }),
      ...(input.description !== undefined && { description: input.description }),
    });
  }

  function updateField(input: UpdateFieldInput): void {
    updateFieldMutation.mutate({
      fieldId: input.fieldId,
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.label !== undefined && { label: input.label }),
      ...(input.fieldType !== undefined && { fieldType: input.fieldType }),
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isIdentifier !== undefined && {
        isIdentifier: input.isIdentifier,
      }),
      ...(input.description !== undefined && { description: input.description }),
    });
  }

  /**
   * deleteField — awaits the FastAPI guard outcome (D-27). When a confirmed
   * component still references the field the server soft-deactivates instead of
   * hard-deleting; the resolved outcome lets the caller message that honestly
   * (never presenting a soft-deactivate as a hard delete).
   */
  async function deleteField(input: {
    readonly fieldId: string;
    readonly entityTypeId: string;
  }): Promise<DeleteFieldOutcome> {
    setDeletingFieldIds((prev) => [...prev, input.fieldId]);
    try {
      const raw = (await deleteFieldMutation.mutateAsync({
        fieldId: input.fieldId,
      })) as DeleteFieldResponse;
      await refetchList();
      const view = raw.data ?? {};
      const outcome: DeleteFieldOutcome = {
        fieldId: view.field_id ?? input.fieldId,
        hardDeleted: view.hard_deleted ?? false,
        softDeactivated: view.soft_deactivated ?? false,
      };
      if (outcome.softDeactivated) {
        toast.success(
          "Field deactivated — it is still referenced by confirmed data, so it was hidden rather than deleted.",
        );
      } else {
        toast.success("Field deleted");
      }
      return outcome;
    } catch (error) {
      // Detailed context to devtools; friendly message to the user (WR-02).
      console.error("[useEntityTypeAdmin] deleteField failed:", error);
      toast.error("The field could not be deleted. Try again.");
      throw error;
    } finally {
      setDeletingFieldIds((prev) => prev.filter((id) => id !== input.fieldId));
    }
  }

  function reorderFields(input: {
    readonly entityTypeId: string;
    readonly orderedFieldIds: readonly string[];
  }): void {
    if (input.orderedFieldIds.length === 0) return;
    reorderFieldsMutation.mutate({
      entityTypeId: input.entityTypeId,
      orderedFieldIds: [...input.orderedFieldIds],
    });
  }

  // ---- In-flight ids (drive disabled controls) ----

  const mutatingTypeIds: readonly string[] = [
    ...(updateTypeMutation.isPending && updateTypeMutation.variables
      ? [updateTypeMutation.variables.entityTypeId]
      : []),
    ...(createFieldMutation.isPending && createFieldMutation.variables
      ? [createFieldMutation.variables.entityTypeId]
      : []),
    ...(reorderFieldsMutation.isPending && reorderFieldsMutation.variables
      ? [reorderFieldsMutation.variables.entityTypeId]
      : []),
  ];

  const mutatingFieldIds: readonly string[] = [
    ...(updateFieldMutation.isPending && updateFieldMutation.variables
      ? [updateFieldMutation.variables.fieldId]
      : []),
    ...deletingFieldIds,
  ];

  return {
    createType,
    updateType,
    createField,
    updateField,
    deleteField,
    reorderFields,
    mutatingTypeIds,
    mutatingFieldIds,
  };
}
