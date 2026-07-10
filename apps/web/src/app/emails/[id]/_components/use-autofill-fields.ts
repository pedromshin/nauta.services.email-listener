"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/** Per-entity autofill phase machine (D-13/D-14/D-15). */
export type AutofillFieldsPhase =
  | "idle"
  | "extracting"
  | "reviewing"
  | "confirmed"
  | "failed";

export interface AutofillFieldsState {
  /** Phase keyed by entity component id. */
  readonly phases: Record<string, AutofillFieldsPhase>;
  /** Run autofill for an entity's field children (non-optimistic). */
  autofillFields: (entityComponentId: string) => void;
  /** Bulk-confirm all candidate field children of an entity (D-14). */
  confirmAllFields: (
    entityComponentId: string,
    candidateFieldIds: readonly string[],
  ) => void;
}

interface UseAutofillFieldsParams {
  readonly emailId: string;
  /**
   * The BULK confirm handler (from use-role-mutations) — "Confirm All Fields"
   * fires N confirms and a SINGLE trailing emails.detail invalidate (MEDIUM-E),
   * never one invalidate per child.
   */
  readonly confirmFields: (componentIds: readonly string[]) => Promise<void>;
}

/**
 * useAutofillFields — the NON-optimistic sub-field autofill hook (D-13/14/15).
 *
 * `autofillFields` POSTs to the entity's autofill-fields endpoint; candidate
 * field children are created server-side, so on success it invalidates
 * `emails.detail` to pick them up (no optimistic insert) and moves the entity's
 * phase to "reviewing". On failure it shows the exact 6000ms degrade toast and
 * sets "failed". `confirmAllFields` bulk-confirms the entity's candidate field
 * children via the supplied confirmFields (D-14: a conscious user action) — one
 * batched server round + a single trailing invalidate (MEDIUM-E).
 */
export function useAutofillFields({
  emailId,
  confirmFields,
}: UseAutofillFieldsParams): AutofillFieldsState {
  const utils = api.useUtils();
  const [phases, setPhases] = useState<Record<string, AutofillFieldsPhase>>({});

  const autofillMutation = api.emails.autofillFields.useMutation({
    onSuccess: async (_data, { entityComponentId }) => {
      await utils.emails.detail.invalidate({ id: emailId });
      setPhases((prev) => ({ ...prev, [entityComponentId]: "reviewing" }));
    },
    onError: (_err, { entityComponentId }) => {
      setPhases((prev) => ({ ...prev, [entityComponentId]: "failed" }));
      toast.error("Autofill isn't available yet — model access is pending.", {
        duration: 6000,
      });
    },
  });

  function autofillFields(entityComponentId: string): void {
    setPhases((prev) => ({ ...prev, [entityComponentId]: "extracting" }));
    autofillMutation.mutate({ entityComponentId });
  }

  function confirmAllFields(
    entityComponentId: string,
    candidateFieldIds: readonly string[],
  ): void {
    // N confirms + ONE trailing emails.detail invalidate (MEDIUM-E), not one
    // invalidate per child. Mark the entity confirmed once the batch resolves.
    void confirmFields(candidateFieldIds).then(() => {
      setPhases((prev) => ({ ...prev, [entityComponentId]: "confirmed" }));
    });
  }

  return { phases, autofillFields, confirmAllFields };
}
