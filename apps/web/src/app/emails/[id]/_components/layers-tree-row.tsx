"use client";

import { ChevronDown, ChevronRight, Square } from "lucide-react";

import { REGION_ROLE_GEOMETRY, REGION_TIER, regionLabelFor, tierOf } from "./region-vocabulary";

import type { ComponentRole } from "./region-overlay-box";

/**
 * The role chip (09-UI-SPEC §LAYERS Panel → Role Chips), re-encoded onto the
 * vocabulary (60-05-PLAN.md Task 2).
 *
 * Pre-60 each role wore its own node-TYPE hue — role-as-hue, which law 3
 * forbids and which post-59 collapsed into three near-identical greys anyway,
 * so the chips had stopped distinguishing anything at all. Role now carries
 * STRUCTURE (border weight/style, from REGION_ROLE_GEOMETRY) over a hue-free
 * chrome fill, mirroring direction-final.html's `.badge.type` treatment: an
 * entity chip is heavy-bordered, a field chip light, an unrelated chip dotted.
 * Colour on this surface belongs to tier alone.
 */
const ROLE_CHIP_BASE = "border-rule bg-shade text-pencil";

const ROLE_LABEL_GEOMETRY: Record<NonNullable<ComponentRole>, string> = {
  entity: REGION_ROLE_GEOMETRY.entity,
  field: REGION_ROLE_GEOMETRY.field,
  unrelated: REGION_ROLE_GEOMETRY.unrelated,
};

const ROLE_LABEL: Record<NonNullable<ComponentRole>, string> = {
  entity: "Entity",
  field: "Field",
  unrelated: "Unrelated",
};

/** A single row in the LAYERS tree. Mirrors the component shape the panel feeds. */
export interface LayersTreeRowComponent {
  readonly id: string;
  readonly role: ComponentRole;
  readonly entityTypeLabel: string | null;
  readonly extractionStatus: string;
  /** The amber FIELD candidate value (auto-escaped React text node — T-09-80). */
  readonly candidateValue: string | null;
  /** Property label for FIELD rows (the entity-type-field label). */
  readonly propertyLabel: string | null;
  /** Detected region text — the primary label for UNCLASSIFIED rows (B1). */
  readonly contentText: string | null;
  /** 1-based page number for the trailing badge. */
  readonly pageNumber: number;
}

interface LayersTreeRowProps {
  readonly component: LayersTreeRowComponent;
  /** Tree depth — ENTITY/UNCLASSIFIED = 0, FIELD = 1 (indented). */
  readonly kind: "entity" | "field" | "unclassified";
  readonly isSelected: boolean;
  /** ENTITY rows only: whether field children are expanded. */
  readonly isExpanded?: boolean;
  /** ENTITY rows only: toggles child visibility (D-12). */
  readonly onToggleExpand?: () => void;
  readonly onSelect: () => void;
  /** FIELD candidate rows only: inline confirm (D-16/D-17). */
  readonly onConfirm?: () => void;
  /** FIELD candidate rows only: inline deny (D-16/D-18). */
  readonly onDeny?: () => void;
}

/**
 * LayersTreeRow — one 36px tree row (D-06/D-12, 09-UI-SPEC §LAYERS Panel).
 *
 * ENTITY: chevron + role chip + label + page badge → click selects + arms
 * active-parent. FIELD (pl-8): role chip + property + ":" + candidate value +
 * inline ✓/✗ (a confirmed row wears the confirmed wash and drops the controls).
 * UNCLASSIFIED: dashed-square icon + detected label. Inline ✓/✗ here are
 * TEXT-row buttons (the canvas overlay gets the floating controls).
 *
 * LAW 1/2/3 ON THIS ROW (60-05-PLAN.md Task 2):
 *   - TIER is the only thing carrying colour, and it resolves through `tierOf`
 *     alone (T-60-08) — never re-derived locally.
 *   - ROLE is structure, never hue (see ROLE_CHIP_BASE above).
 *   - Text the DOCUMENT wrote (a candidate value, a detected snippet) is
 *     EVIDENCE: serif, marked `data-evidence`. Text polytoken wrote (a property
 *     label, an entity-type name, a status word) is chrome: sans. The
 *     unclassified row's three-way label fallback is discriminated by
 *     `regionLabelFor`, which exists precisely so that fallback can obey law 2
 *     instead of collapsing three provenances into one string.
 *   - The ✗ DENY control KEEPS madder (§D): it performs an irreversible action
 *     (soft-reject / clear value), which is exactly what law 1 earns madder
 *     for. The ✓ confirm states a tier, so it wears the confirmed token.
 */
export function LayersTreeRow({
  component,
  kind,
  isSelected,
  isExpanded = false,
  onToggleExpand,
  onSelect,
  onConfirm,
  onDeny,
}: LayersTreeRowProps) {
  const tier = tierOf(component.extractionStatus);
  const isConfirmed = tier === "confirmed";
  const showConfirmDeny =
    kind === "field" && !isConfirmed && component.candidateValue !== null;

  const selectedClass = isSelected
    ? "bg-primary/10 border-l-2 border-primary"
    : "border-l-2 border-transparent";

  if (kind === "entity") {
    return (
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isExpanded}
        className={`flex items-center gap-2 py-2 px-3 hover:bg-muted cursor-pointer ${selectedClass}`}
        style={{ height: 36 }}
        onClick={onSelect}
      >
        <button
          type="button"
          aria-label={isExpanded ? "Collapse fields" : "Expand fields"}
          className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
        <span
          data-role="entity"
          className={`shrink-0 text-xs px-2 py-1 rounded-sm font-semibold ${ROLE_CHIP_BASE} ${ROLE_LABEL_GEOMETRY.entity}`}
        >
          {ROLE_LABEL.entity}
        </span>
        <span className="flex-1 text-sm font-semibold truncate">
          {component.entityTypeLabel ?? "Untitled entity"}
        </span>
        <span className="shrink-0 text-xs text-pencil tabular">
          p{component.pageNumber}
        </span>
      </div>
    );
  }

  if (kind === "field") {
    return (
      <div
        role="treeitem"
        aria-selected={isSelected}
        className={`flex items-center gap-2 py-2 pl-8 pr-3 hover:bg-muted cursor-pointer ${
          isConfirmed ? "bg-conf-wash" : ""
        } ${selectedClass}`}
        style={{ height: 36 }}
        onClick={onSelect}
      >
        <span
          data-role="field"
          className={`shrink-0 text-xs px-2 py-1 rounded-sm font-semibold ${ROLE_CHIP_BASE} ${ROLE_LABEL_GEOMETRY.field}`}
        >
          {ROLE_LABEL.field}
        </span>
        {/* polytoken's word for the slot — chrome, so sans. */}
        <span className="text-xs text-pencil truncate min-w-0 max-w-[140px]">
          {component.propertyLabel ?? "field"}
        </span>
        <span className="text-pencil">:</span>
        {/* The document's own words — evidence, so serif + the tier's own mark. */}
        <span
          data-field="value"
          data-tier={tier}
          data-evidence
          className={`flex-1 min-w-0 truncate text-sm ${REGION_TIER[tier].chip} font-serif`}
        >
          {component.candidateValue ?? ""}
        </span>
        {showConfirmDeny && (
          <span
            className="shrink-0 flex items-center gap-1"
            role="group"
            aria-label="Confirm or deny field value"
          >
            <button
              type="button"
              aria-label="Confirm field value"
              className="h-4 w-4 rounded-full bg-conf hover:bg-conf/90 active:bg-conf/80 text-on-fill flex items-center justify-center text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={(e) => {
                e.stopPropagation();
                onConfirm?.();
              }}
            >
              ✓
            </button>
            <button
              type="button"
              aria-label="Deny field value"
              className="h-4 w-4 rounded-full bg-destructive hover:bg-destructive/90 active:bg-destructive/80 text-destructive-foreground flex items-center justify-center text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={(e) => {
                e.stopPropagation();
                onDeny?.();
              }}
            >
              ✗
            </button>
          </span>
        )}
      </div>
    );
  }

  // UNCLASSIFIED (role === null). B1: the primary label is the detected text
  // (entity-type label if one exists, else a content snippet), NOT the raw
  // extraction_status — status is demoted to a small trailing chip.
  //
  // `regionLabelFor` preserves B1's precedence EXACTLY while telling us which
  // of the three provenances won, which is what law 2 needs: only the
  // content-snippet case is the document's own words, so only it earns the
  // serif. The pre-60 `??` chain collapsed all three into one string and so
  // could not obey law 2 even in principle.
  const label = regionLabelFor(component);
  const isDetectedText = label.kind === "text";
  const unclassifiedLabel = label.kind === "status" ? "Unlabeled region" : label.text;
  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      className={`flex items-center gap-2 py-2 px-3 hover:bg-muted cursor-pointer ${selectedClass}`}
      style={{ height: 36 }}
      onClick={onSelect}
    >
      <Square className="h-3 w-3 text-pencil shrink-0" aria-hidden="true" />
      <span
        {...(isDetectedText ? { "data-field": "value", "data-evidence": true } : {})}
        className={`flex-1 truncate text-sm ${isDetectedText ? "font-serif text-ink" : "text-pencil"}`}
      >
        {unclassifiedLabel}
      </span>
      <span
        data-field="tier-badge"
        data-tier={tier}
        className={`shrink-0 text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-sm ${REGION_TIER[tier].badge}`}
      >
        {component.extractionStatus}
      </span>
      <span className="shrink-0 text-xs text-pencil tabular">
        p{component.pageNumber}
      </span>
    </div>
  );
}
