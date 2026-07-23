"use client";

import { toast } from "sonner";

import { api } from "~/trpc/react";

import type { ComponentRole } from "./region-overlay-box";

/**
 * use-role-mutations — the relationship + review mutation hook (D-15).
 *
 * setRole / setEntityType / setFieldRelationship / confirmField / confirmFields /
 * denyField are OPTIMISTIC: snapshot emails.detail, patch the matching
 * component, revert + toast on error (mirrors use-region-edit). The
 * NON-optimistic sub-field autofill machine lives in its own canonical hook
 * (use-autofill-fields) — it is not duplicated here.
 */
export interface RoleMutationsState {
  setRole: (componentId: string, role: ComponentRole) => void;
  setEntityType: (componentId: string, entityTypeId: string | null) => void;
  setFieldRelationship: (
    componentId: string,
    parentComponentId: string | null,
    entityTypeFieldId: string | null,
  ) => void;
  confirmField: (
    componentId: string,
    correctedFields?: Record<string, unknown> | null,
  ) => void;
  /**
   * Bulk-confirm several field children (D-14 "Confirm All Fields"). Issues N
   * confirm mutations and then a SINGLE trailing emails.detail invalidate — NOT
   * one invalidate per child (which fans out N refetches for one user action).
   */
  confirmFields: (componentIds: readonly string[]) => Promise<void>;
  denyField: (componentId: string) => void;

  /** Component ids with an in-flight mutation (drives aria-busy + pulse). */
  readonly mutatingComponentIds: readonly string[];
}

interface UseRoleMutationsParams {
  readonly emailId: string;
}

/** Snapshot of the emails.detail cache, captured for optimistic revert. */
type DetailSnapshot = ReturnType<
  ReturnType<typeof api.useUtils>["emails"]["detail"]["getData"]
>;

/** The lineage origin marker AutofillFieldsUseCase stamps on auto-detected boxes. */
const AUTO_DETECTED_ORIGIN = "auto_detected";

/**
 * WR-05 — read the lineage origin from a component's content_raw, mirroring the
 * server's DenyFieldUseCase logic (both the nested `lineage.origin` Phase-6
 * convention and a flat top-level `origin`). Returns true only for an
 * auto-detected box; any other value (including null/missing) means user-drawn.
 */
function isAutoDetectedOrigin(contentRaw: unknown): boolean {
  if (contentRaw === null || typeof contentRaw !== "object") return false;
  const raw = contentRaw as Record<string, unknown>;
  const lineage = raw.lineage;
  if (lineage !== null && typeof lineage === "object") {
    const origin = (lineage as Record<string, unknown>).origin;
    if (typeof origin === "string") return origin === AUTO_DETECTED_ORIGIN;
  }
  return raw.origin === AUTO_DETECTED_ORIGIN;
}

export function useRoleMutations({
  emailId,
}: UseRoleMutationsParams): RoleMutationsState {
  const utils = api.useUtils();

  // Snapshot the current detail query for revert-on-error.
  function snapshot(): { prevData: DetailSnapshot } {
    return { prevData: utils.emails.detail.getData({ id: emailId }) };
  }

  function revert(context: { prevData: DetailSnapshot } | undefined): void {
    if (context?.prevData !== undefined) {
      utils.emails.detail.setData({ id: emailId }, context.prevData);
    }
  }

  // ---- setRole (optimistic, D-10) ----
  const setRoleMutation = api.emails.setRole.useMutation({
    onMutate: async ({ componentId, role }) => {
      await utils.emails.detail.cancel({ id: emailId });
      const snap = snapshot();
      utils.emails.detail.setData({ id: emailId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map((c) =>
            c.id === componentId ? { ...c, role } : c,
          ),
        };
      });
      return snap;
    },
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
    },
    onError: (_err, _vars, context) => {
      revert(context);
      toast.error("Role update failed — changes were not saved.", {
        duration: 6000,
      });
    },
  });

  // ---- setEntityType (optimistic, D-03/D-11) ----
  const setEntityTypeMutation = api.emails.setEntityType.useMutation({
    onMutate: async ({ componentId, entityTypeId }) => {
      await utils.emails.detail.cancel({ id: emailId });
      const snap = snapshot();
      utils.emails.detail.setData({ id: emailId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map((c) =>
            c.id === componentId ? { ...c, entityTypeId } : c,
          ),
        };
      });
      return snap;
    },
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
    },
    onError: (_err, _vars, context) => {
      revert(context);
      toast.error("Relationship update failed — changes were not saved.", {
        duration: 6000,
      });
    },
  });

  // ---- setFieldRelationship (optimistic, D-04/D-11) ----
  const setFieldRelationshipMutation =
    api.emails.setFieldRelationship.useMutation({
      onMutate: async ({
        componentId,
        parentComponentId,
        entityTypeFieldId,
      }) => {
        await utils.emails.detail.cancel({ id: emailId });
        const snap = snapshot();
        utils.emails.detail.setData({ id: emailId }, (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            components: prev.components.map((c) =>
              c.id === componentId
                ? { ...c, parentComponentId, entityTypeFieldId }
                : c,
            ),
          };
        });
        return snap;
      },
      onSuccess: async () => {
        await utils.emails.detail.invalidate({ id: emailId });
      },
      onError: (_err, _vars, context) => {
        revert(context);
        toast.error("Relationship update failed — changes were not saved.", {
          duration: 6000,
        });
      },
    });

  // ---- confirmField (optimistic, D-16/D-17) ----
  const confirmFieldMutation = api.emails.confirmField.useMutation({
    onMutate: async ({ componentId }) => {
      await utils.emails.detail.cancel({ id: emailId });
      const snap = snapshot();
      utils.emails.detail.setData({ id: emailId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map((c) =>
            c.id === componentId
              ? { ...c, extractionStatus: "confirmed" as const }
              : c,
          ),
        };
      });
      return snap;
    },
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
    },
    onError: (_err, _vars, context) => {
      revert(context);
      toast.error("Could not confirm field. Try again.");
    },
  });

  // ---- confirmField (bulk, D-14) — NO per-call invalidate ----
  // Used only by confirmFields: the optimistic patch + the single trailing
  // invalidate are owned by confirmFields so N confirms do not fan out into N
  // refetches. onError reverts via the caller-supplied snapshot context.
  const confirmFieldBulkMutation = api.emails.confirmField.useMutation();

  // ---- denyField (optimistic, D-16/D-18 — ORIGIN-AWARE, WR-05) ----
  // The optimistic patch now mirrors the server's origin-aware outcome so a
  // user-drawn box is NEVER transiently flipped to "rejected" ("your boxes never
  // disappear"). Auto-detected deny soft-rejects (box leaves the default view);
  // user-drawn deny keeps the geometry and only clears the wrong mapping/value.
  // The post-success invalidate reconciles the authoritative server outcome.
  const denyFieldMutation = api.emails.denyField.useMutation({
    onMutate: async ({ componentId }) => {
      await utils.emails.detail.cancel({ id: emailId });
      const snap = snapshot();
      const target = snap.prevData?.components.find((c) => c.id === componentId);
      const autoDetected = isAutoDetectedOrigin(target?.contentRaw);
      utils.emails.detail.setData({ id: emailId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map((c) => {
            if (c.id !== componentId) return c;
            if (autoDetected) {
              // Auto-detected guess: soft-reject — removed from default view.
              return { ...c, extractionStatus: "rejected" as const };
            }
            // User-drawn box: keep geometry + status; only clear the wrong
            // candidate value + field mapping (reverts to unclassified-with-box).
            return {
              ...c,
              entityTypeFieldId: null,
              extractedFields: null,
            };
          }),
        };
      });
      return snap;
    },
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
    },
    onError: (_err, _vars, context) => {
      revert(context);
      toast.error("Could not deny field. Try again.");
    },
  });

  // UI-1 / UI-3: the optimistic-only `restoreField` (undo an auto-detected
  // deny) and `unconfirmField` (demote a confirmed field) were removed. Both
  // only patched the query cache and immediately invalidated — the refetch
  // reverted the flip within one round-trip because no server endpoint exists
  // (/accept is pending→candidate only; there is no un-reject or un-confirm).
  // A control that visibly reverts itself is worse than none; when the real
  // endpoints ship, reintroduce these as genuine mutations, not cache pokes.

  // ---- Public handlers ----

  function setRole(componentId: string, role: ComponentRole): void {
    setRoleMutation.mutate({ componentId, role });
  }

  function setEntityType(
    componentId: string,
    entityTypeId: string | null,
  ): void {
    setEntityTypeMutation.mutate({ componentId, entityTypeId });
  }

  function setFieldRelationship(
    componentId: string,
    parentComponentId: string | null,
    entityTypeFieldId: string | null,
  ): void {
    setFieldRelationshipMutation.mutate({
      componentId,
      parentComponentId,
      entityTypeFieldId,
    });
  }

  function confirmField(
    componentId: string,
    correctedFields: Record<string, unknown> | null = null,
  ): void {
    confirmFieldMutation.mutate({ componentId, correctedFields });
  }

  // D-14: confirm N field children, then invalidate emails.detail exactly ONCE.
  async function confirmFields(
    componentIds: readonly string[],
  ): Promise<void> {
    if (componentIds.length === 0) return;
    const ids = new Set(componentIds);

    await utils.emails.detail.cancel({ id: emailId });
    const snap = snapshot();

    // Single optimistic patch marking every target confirmed at once.
    utils.emails.detail.setData({ id: emailId }, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        components: prev.components.map((c) =>
          ids.has(c.id) ? { ...c, extractionStatus: "confirmed" as const } : c,
        ),
      };
    });

    try {
      // Fire all confirms (no per-call invalidate — confirmFieldBulkMutation has
      // no onSuccess) and wait for them all to settle.
      await Promise.all(
        componentIds.map((componentId) =>
          confirmFieldBulkMutation.mutateAsync({
            componentId,
            correctedFields: null,
          }),
        ),
      );
    } catch {
      revert(snap);
      toast.error("Could not confirm all fields. Try again.");
      return;
    }

    // ONE trailing invalidate reconciles the authoritative server state.
    await utils.emails.detail.invalidate({ id: emailId });
  }

  function denyField(componentId: string): void {
    denyFieldMutation.mutate({ componentId });
  }

  // Component ids with an in-flight mutation — drives aria-busy + pulse styling.
  const mutatingComponentIds: readonly string[] = [
    ...(setRoleMutation.isPending && setRoleMutation.variables
      ? [setRoleMutation.variables.componentId]
      : []),
    ...(setEntityTypeMutation.isPending && setEntityTypeMutation.variables
      ? [setEntityTypeMutation.variables.componentId]
      : []),
    ...(setFieldRelationshipMutation.isPending &&
    setFieldRelationshipMutation.variables
      ? [setFieldRelationshipMutation.variables.componentId]
      : []),
    ...(confirmFieldMutation.isPending && confirmFieldMutation.variables
      ? [confirmFieldMutation.variables.componentId]
      : []),
    ...(denyFieldMutation.isPending && denyFieldMutation.variables
      ? [denyFieldMutation.variables.componentId]
      : []),
  ];

  return {
    setRole,
    setEntityType,
    setFieldRelationship,
    confirmField,
    confirmFields,
    denyField,

    mutatingComponentIds,
  };
}
