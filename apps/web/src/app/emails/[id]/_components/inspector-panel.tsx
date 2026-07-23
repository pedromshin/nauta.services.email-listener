"use client";

// Explicit React namespace import (not just the named hook) — this file's JSX
// compiles under Next.js's SWC automatic runtime, but vitest's plain esbuild
// transform defaults to the classic runtime (React.createElement) and needs
// `React` in scope whenever a test mounts this component directly (same note
// as region-overlay-box.tsx; needed by inspector-confirm-correction.test.tsx,
// the first test to mount InspectorPanel directly — UI-2).
import * as React from "react";
import { useState } from "react";
import { Loader2, MousePointer2, Sparkles } from "lucide-react";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import { Input } from "@polytoken/ui/input";

import { EntityTypePicker } from "./entity-type-picker";
import { FieldRelationshipPicker } from "./field-relationship-picker";
import { REGION_ROLE_LABEL, REGION_ROLE_SWATCH } from "./region-vocabulary";
import { RolePicker } from "./role-picker";
import { getStatusBadge } from "./status-badge";

import type { AutofillFieldsPhase } from "./use-autofill-fields";
import type { ParentEntityOption } from "./field-relationship-picker";
import type { ComponentRole } from "~/components/regions/region-overlay-box";

/** The selected component, as the inspector consumes it (subset of detail). */
export interface InspectorComponent {
  readonly id: string;
  readonly role: ComponentRole;
  readonly entityTypeId: string | null;
  readonly entityTypeFieldId: string | null;
  readonly parentComponentId: string | null;
  readonly entityTypeLabel: string | null;
  readonly extractionStatus: string;
  readonly pageNumber: number;
  /** AI candidate value (auto-escaped React text node — T-09-80). */
  readonly candidateValue: string | null;
  /**
   * The extractedFields key the candidate value lives under (its mapped
   * property slug, or the single-entry key of an unmapped blob). Needed to
   * build corrected_fields when the user edits the value before confirming
   * (UI-2). Null when no addressable key exists — the correction cannot be
   * keyed and Confirm falls back to confirming the machine value as-is.
   */
  readonly candidateFieldKey: string | null;
  /** Overall confidence for the candidate value (0..1), if present. */
  readonly confidenceScore: number | null;
  /** Resolved field-property label for a FIELD. */
  readonly propertyLabel: string | null;
  /** Candidate field children ids (for "Confirm All Fields"). */
  readonly candidateFieldIds: readonly string[];
}

interface InspectorPanelProps {
  readonly selected: InspectorComponent | null;
  /** Same-page ENTITY regions for the parent picker (06-04 pattern). */
  readonly parentOptions: readonly ParentEntityOption[];
  /** Entity-type label resolved from the component's entityTypeId. */
  readonly entityTypeLabel: string | null;
  /** Autofill phase for the selected entity (if any). */
  readonly autofillPhase: AutofillFieldsPhase | undefined;

  // ---- Mutations (use-role-mutations + use-autofill-fields) ----
  readonly onSetRole: (componentId: string, role: ComponentRole) => void;
  /** Resolve a chosen entity-type SLUG → id, then setEntityType. */
  readonly onSetEntityTypeSlug: (componentId: string, slug: string) => void;
  readonly onSetFieldRelationship: (
    componentId: string,
    parentComponentId: string | null,
    entityTypeFieldId: string | null,
  ) => void;
  readonly onAutofillFields: (entityComponentId: string) => void;
  readonly onConfirmAllFields: (
    entityComponentId: string,
    candidateFieldIds: readonly string[],
  ) => void;
  /**
   * Confirm a candidate field. When the user edits the candidate value in the
   * Inspector, the edited value is passed as a keyed correction (UI-2) so the
   * human's correction — not the machine's original read — becomes the
   * confirmed record and feeds the flywheel.
   */
  readonly onConfirmField: (
    componentId: string,
    correctedFields?: Record<string, unknown> | null,
  ) => void;
}

/**
 * Compact role marker used in the Region Identity section.
 *
 * Pre-60 this was a map of one node-TYPE hue per role (a tinted fill plus
 * matching text, three times over) — a ROLE encoded in a hue, which law 3
 * gives to shape and law 1 forbids on chrome outright. The retired tokens
 * are described rather than named: `role-hue-ban.test.ts` walks this file
 * line by line and cannot tell a citation from a class. It now states the
 * role the same way the
 * Role picker does and the same way the page does: the miniature box
 * geometry (`REGION_ROLE_SWATCH`) over a hue-free chrome fill, with
 * polytoken's word for the role beside it (`REGION_ROLE_LABEL` — one map,
 * shared with the picker, so the two cannot disagree about what the user
 * just clicked). Tier — the one thing that HAS earned colour here — is
 * stated separately, by the status badge below, through `tierOf`.
 */
const ROLE_MARKER = "inline-flex items-center gap-1.5 rounded-sm bg-shade px-2 py-1 text-2xs font-semibold text-ink";

/**
 * InspectorPanel — the single role + relationship control point (D-11,
 * 09-UI-SPEC §INSPECTOR Panel).
 */
export function InspectorPanel({
  selected,
  parentOptions,
  entityTypeLabel,
  autofillPhase,
  onSetRole,
  onSetEntityTypeSlug,
  onSetFieldRelationship,
  onAutofillFields,
  onConfirmAllFields,
  onConfirmField,
}: InspectorPanelProps) {
  const [entityTypeOpen, setEntityTypeOpen] = useState(false);

  if (selected === null) {
    return (
      <aside
        className="flex flex-col h-full"
        role="complementary"
        aria-label="Region inspector"
      >
        <div className="py-12 px-6 text-center text-sm text-muted-foreground space-y-2">
          <MousePointer2
            className="h-8 w-8 text-muted-foreground/50 mx-auto"
            aria-hidden="true"
          />
          <p className="text-foreground font-semibold">Select a region</p>
          <p>
            Click a box on the canvas or a row in the Layers panel to inspect it.
          </p>
        </div>
      </aside>
    );
  }

  const role = selected.role;
  const statusBadge = getStatusBadge(selected.extractionStatus);
  const isExtracting = autofillPhase === "extracting";
  const showAutofill = role === "entity" && selected.entityTypeId !== null;
  const showCandidateValue =
    role === "field" &&
    selected.candidateValue !== null &&
    selected.extractionStatus !== "confirmed";
  const showConfirmed =
    role === "field" && selected.extractionStatus === "confirmed";
  /**
   * A weak candidate is a WARNING, and law 1 spends madder only on the
   * irreversible — "never errors, never warnings" (58-IDENTITY). Pre-60 this
   * painted the percentage in madder text, which told the user an uncertain
   * guess was a dangerous one. (The retired class is described rather than
   * named: `role-hue-ban.test.ts` walks this file line by line and cannot
   * tell a citation from a class.) It is neither: it is a machine's
   * low-confidence read that
   * a human is about to confirm or correct, which is the entire job of this
   * panel. Distinguished now by ink WEIGHT, not hue, so it survives
   * greyscale — and pencil, not madder, is the ladder's word for "uncertain".
   * The tier hues are not available here either: `sugg` means "suggested",
   * not "suspect", and a hue means exactly one thing.
   */
  const lowConfidence =
    selected.confidenceScore !== null && selected.confidenceScore < 0.5;

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      role="complementary"
      aria-label="Region inspector"
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Section 1: Region Identity */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {role !== null && (
              <span className={ROLE_MARKER}>
                <span className={REGION_ROLE_SWATCH[role]} aria-hidden="true" />
                {REGION_ROLE_LABEL[role]}
              </span>
            )}
            <span className="text-sm font-semibold truncate text-ink">
              {selected.entityTypeLabel ??
                selected.propertyLabel ??
                "Region"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-pencil">
            <Badge
              variant={statusBadge.variant}
              className={["text-xs", statusBadge.className]
                .filter(Boolean)
                .join(" ")}
            >
              {selected.extractionStatus}
            </Badge>
            <span className="tabular">· Page {selected.pageNumber}</span>
          </div>
        </div>

        {/* Section 2: Role Picker */}
        <RolePicker
          value={role}
          onSelect={(next) => onSetRole(selected.id, next)}
        />

        {/* Section 3: Entity Type Picker (role = entity OR field) */}
        {(role === "entity" || role === "field") && (
          <div className="space-y-1">
            <p className="text-2xs font-semibold uppercase tracking-wide text-pencil">
              Entity type
            </p>
            <EntityTypePicker
              open={entityTypeOpen}
              onOpenChange={setEntityTypeOpen}
              onSelect={(slug) => onSetEntityTypeSlug(selected.id, slug)}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  aria-expanded={entityTypeOpen}
                >
                  {entityTypeLabel ?? "Select entity type…"}
                </Button>
              }
            />
          </div>
        )}

        {/* Section 3b: Field relationship pickers (role = field) */}
        {role === "field" && (
          <FieldRelationshipPicker
            parentOptions={parentOptions}
            parentComponentId={selected.parentComponentId}
            entityTypeFieldId={selected.entityTypeFieldId}
            onSelect={(parentId, fieldId) =>
              onSetFieldRelationship(selected.id, parentId, fieldId)
            }
          />
        )}

        {/* Section 4: Sub-field Autofill (role = entity AND entityTypeId set) */}
        {showAutofill && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full"
              disabled={isExtracting}
              aria-busy={isExtracting}
              onClick={() => onAutofillFields(selected.id)}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Extracting…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
                  Autofill Fields
                </>
              )}
            </Button>
            {selected.candidateFieldIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                title="Confirms all candidate field values for this entity. You can still edit them individually afterward."
                onClick={() =>
                  onConfirmAllFields(selected.id, selected.candidateFieldIds)
                }
              >
                Confirm All Fields
              </Button>
            )}
          </div>
        )}

        {/* Section 5a: Confirmed field — show the confirmed value (read-only).
            UI-3: the "Unconfirm Field" control was removed. It was a no-op —
            an optimistic status flip that its own refetch immediately reverted,
            with no server endpoint behind it (/accept only handles
            pending→candidate, never confirmed→candidate). A control that
            visibly reverts itself is worse than none; the honest surface shows
            the confirmed value and no fake demote affordance. */}
        {showConfirmed && selected.candidateValue !== null && (
          <div className="space-y-1">
            <p className="text-2xs font-semibold uppercase tracking-wide text-pencil">
              Confirmed value
            </p>
            {/* The document's own words — law 2's evidence, even inside a
                control. The field is the product; the label above it is
                polytoken's chrome and stays quiet sans. */}
            <Input
              className="h-8 text-sm font-serif tabular"
              data-evidence
              defaultValue={selected.candidateValue}
              readOnly
              aria-label="Confirmed value"
            />
          </div>
        )}

        {/* Section 5: Candidate Value (role = field AND candidate present).
            UI-2: the input is CONTROLLED and its edited value is threaded into
            the confirm as a keyed correction, so a human who fixes the machine's
            read has their value confirmed (and fed to the flywheel) — not the
            original. `key` on the editor resets its state when the selection
            changes. */}
        {showCandidateValue && (
          <CandidateValueEditor
            key={selected.id}
            candidateValue={selected.candidateValue ?? ""}
            candidateFieldKey={selected.candidateFieldKey}
            confidenceScore={selected.confidenceScore}
            lowConfidence={lowConfidence}
            onConfirm={(correctedFields) =>
              onConfirmField(selected.id, correctedFields)
            }
          />
        )}
      </div>
    </aside>
  );
}

/**
 * CandidateValueEditor — the controlled "Candidate value" editor + Confirm
 * button (UI-2). Kept as a keyed child so React remounts it (and re-seeds its
 * state) whenever the inspected region changes.
 *
 * On Confirm: if the user edited the value AND the field has an addressable
 * key, the edited value is sent as `{ [key]: value }` corrected_fields (the
 * backend already stores + embeds corrected_fields over the machine read). If
 * unchanged, or if no key exists to address the correction, it confirms the
 * machine value as-is (correctedFields = null).
 */
export function CandidateValueEditor({
  candidateValue,
  candidateFieldKey,
  confidenceScore,
  lowConfidence,
  onConfirm,
}: {
  readonly candidateValue: string;
  readonly candidateFieldKey: string | null;
  readonly confidenceScore: number | null;
  readonly lowConfidence: boolean;
  readonly onConfirm: (
    correctedFields: Record<string, unknown> | null,
  ) => void;
}) {
  const [value, setValue] = useState(candidateValue);
  const edited = value !== candidateValue;

  function handleConfirm(): void {
    const correction =
      edited && candidateFieldKey !== null
        ? { [candidateFieldKey]: value }
        : null;
    onConfirm(correction);
  }

  return (
    <div className="space-y-1">
      <p className="text-2xs font-semibold uppercase tracking-wide text-pencil">
        Candidate value
      </p>
      {/* Evidence: what the machine read off the page — now editable so a
          correction survives the confirm (UI-2). */}
      <Input
        className="h-8 text-sm font-serif tabular"
        data-evidence
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Candidate value"
      />
      {confidenceScore !== null && (
        <span
          className={`text-xs tabular ${
            lowConfidence ? "font-semibold text-ink" : "text-pencil"
          }`}
        >
          {Math.round(confidenceScore * 100)}% confidence
        </span>
      )}
      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-full"
        onClick={handleConfirm}
      >
        Confirm Field
      </Button>
    </div>
  );
}
