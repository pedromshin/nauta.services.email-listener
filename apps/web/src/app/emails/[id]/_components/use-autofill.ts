"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

// ---- Types ----

export type AutofillPhase =
  | "idle"
  | "picking"
  | "extracting"
  | "reviewing"
  | "confirming"
  | "confirmed"
  | "failed";

export interface ExtractionResult {
  readonly extractedFields: Record<string, unknown>;
  readonly confidenceScore: number;
  readonly confidenceBreakdown: Record<string, unknown> | null;
}

interface ExtractionResultRaw {
  readonly extracted_fields: Record<string, unknown>;
  readonly confidence_score: number;
  readonly confidence_breakdown: Record<string, unknown> | null;
}

export interface AutofillState {
  readonly autofillState: Record<string, AutofillPhase>;
  readonly extractionResults: Record<string, ExtractionResult>;
  readonly fieldValues: Record<string, Record<string, string>>;
  readonly pickerOpenFor: string | null;
  openPicker: (componentId: string) => void;
  closePicker: () => void;
  startAutofill: (componentId: string, entityTypeSlug: string) => void;
  setFieldValue: (componentId: string, key: string, value: string) => void;
  confirmFields: (componentId: string) => void;
  discardFields: (componentId: string) => void;
  reset: (componentId: string) => void;
}

interface UseAutofillParams {
  readonly emailId: string;
}

// ---- Hook ----

export function useAutofill({ emailId }: UseAutofillParams): AutofillState {
  const utils = api.useUtils();

  const [autofillState, setAutofillState] = useState<
    Record<string, AutofillPhase>
  >({});
  const [extractionResults, setExtractionResults] = useState<
    Record<string, ExtractionResult>
  >({});
  const [fieldValues, setFieldValues] = useState<
    Record<string, Record<string, string>>
  >({});
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);

  // ---- autofillComponent mutation (no optimistic update) ----

  const autofillMutation = api.emails.autofillComponent.useMutation({
    onSuccess: (
      data: unknown,
      variables: { componentId: string; entityTypeSlug: string },
    ) => {
      const raw = (data as { data: ExtractionResultRaw }).data;
      const result: ExtractionResult = {
        extractedFields: raw.extracted_fields,
        confidenceScore: raw.confidence_score,
        confidenceBreakdown: raw.confidence_breakdown,
      };
      setAutofillState((prev) => ({
        ...prev,
        [variables.componentId]: "reviewing",
      }));
      setExtractionResults((prev) => ({
        ...prev,
        [variables.componentId]: result,
      }));
      setFieldValues((prev) => ({
        ...prev,
        [variables.componentId]: Object.fromEntries(
          Object.entries(raw.extracted_fields).map(([k, v]) => [
            k,
            String(v ?? ""),
          ]),
        ),
      }));
    },
    onError: (
      _err: unknown,
      variables: { componentId: string; entityTypeSlug: string },
    ) => {
      setAutofillState((prev) => ({
        ...prev,
        [variables.componentId]: "idle",
      }));
      toast.error(
        "AI autofill is unavailable — model access is pending.",
        { duration: 6000 },
      );
    },
  });

  // ---- confirmComponent mutation (invalidate, no optimistic) ----

  const confirmMutation = api.emails.confirmComponent.useMutation({
    onSuccess: async (
      _data: unknown,
      variables: {
        componentId: string;
        correctedFields: Record<string, unknown> | null;
      },
    ) => {
      await utils.emails.detail.invalidate({ id: emailId });
      setAutofillState((prev) => ({
        ...prev,
        [variables.componentId]: "confirmed",
      }));
      toast.success("Fields confirmed");
    },
    onError: (
      _err: unknown,
      variables: {
        componentId: string;
        correctedFields: Record<string, unknown> | null;
      },
    ) => {
      setAutofillState((prev) => ({
        ...prev,
        [variables.componentId]: "reviewing",
      }));
      toast.error("Could not confirm fields. Try again.");
    },
  });

  // ---- Handlers ----

  function openPicker(componentId: string): void {
    setPickerOpenFor(componentId);
    setAutofillState((prev) => ({ ...prev, [componentId]: "picking" }));
  }

  function closePicker(): void {
    setPickerOpenFor((prevPicker) => {
      if (prevPicker !== null) {
        setAutofillState((prev) => {
          if (prev[prevPicker] === "picking") {
            return { ...prev, [prevPicker]: "idle" };
          }
          return prev;
        });
      }
      return null;
    });
  }

  function startAutofill(componentId: string, entityTypeSlug: string): void {
    setAutofillState((prev) => ({ ...prev, [componentId]: "extracting" }));
    setPickerOpenFor(null);
    autofillMutation.mutate({ componentId, entityTypeSlug });
  }

  function setFieldValue(
    componentId: string,
    key: string,
    value: string,
  ): void {
    setFieldValues((prev) => ({
      ...prev,
      [componentId]: {
        ...(prev[componentId] ?? {}),
        [key]: value,
      },
    }));
  }

  function confirmFields(componentId: string): void {
    if (confirmMutation.isPending) return;

    const result = extractionResults[componentId];

    if (!result) {
      toast.error("Extraction result unavailable. Please retry autofill.");
      setAutofillState((prev) => ({ ...prev, [componentId]: "idle" }));
      return;
    }

    const currentValues = fieldValues[componentId] ?? {};

    // Compute correctedFields: iterate extractedFields keys (source of truth)
    // so fields extracted but never written to fieldValues are not silently dropped.
    const correctedFields: Record<string, unknown> = {};
    for (const key of Object.keys(result.extractedFields)) {
      const current = currentValues[key] ?? String(result.extractedFields[key] ?? "");
      const original = String(result.extractedFields[key] ?? "");
      if (current !== original) {
        correctedFields[key] = current;
      }
    }

    const correctedFieldsPayload =
      Object.keys(correctedFields).length > 0 ? correctedFields : null;

    setAutofillState((prev) => ({ ...prev, [componentId]: "confirming" }));
    confirmMutation.mutate({
      componentId,
      correctedFields: correctedFieldsPayload,
    });
  }

  function discardFields(componentId: string): void {
    // NO API call — server record untouched (D-16)
    setExtractionResults((prev) => {
      const { [componentId]: _removed, ...rest } = prev;
      return rest;
    });
    setFieldValues((prev) => {
      const { [componentId]: _removed, ...rest } = prev;
      return rest;
    });
    setAutofillState((prev) => ({ ...prev, [componentId]: "idle" }));
  }

  function reset(componentId: string): void {
    setAutofillState((prev) => ({ ...prev, [componentId]: "idle" }));
  }

  return {
    autofillState,
    extractionResults,
    fieldValues,
    pickerOpenFor,
    openPicker,
    closePicker,
    startAutofill,
    setFieldValue,
    confirmFields,
    discardFields,
    reset,
  };
}
