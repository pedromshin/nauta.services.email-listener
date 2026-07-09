"use client";

import { polygonToRect } from "@polytoken/api-client/geometry";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@polytoken/ui/tooltip";

import { ConfirmDenyControls } from "./confirm-deny-controls";
import { contentSnippet } from "./region-label";

interface ComponentLocation {
  page_index?: number;
  polygon?: ReadonlyArray<readonly [number, number]>;
  type: string;
}

/** Region relationship role (D-01/D-10). null = unclassified/standalone. */
export type ComponentRole = "entity" | "field" | "unrelated" | null;

interface RegionComponent {
  id: string;
  attachmentId: string | null;
  sourceType: string;
  contentText: string | null;
  extractionStatus: string;
  location: unknown;
  entityTypeLabel: string | null;
  entityTypeSlug: string | null;
  extractedFields: unknown;
  confidenceScore: unknown;
  /** Phase 9 (D-10): relationship role, drives role-color rendering. Optional for back-compat. */
  role?: ComponentRole;
}

interface PageSize {
  width: number;
  height: number;
}

interface RegionOverlayBoxProps {
  component: RegionComponent;
  pageSize: PageSize;
  activeComponentId: string | null;
  setActiveComponentId: (id: string | null) => void;
  onSelectComponent?: (id: string) => void;
  onShiftClick?: (id: string) => void;
  isSelected?: boolean;
  isMutating?: boolean;
  /** Phase 9 (D-10): when true, draws the active-parent ENTITY ring (ring-4 ring-violet-400/40). */
  isActiveParent?: boolean;
  /** Phase 9 (D-16): when true, renders the inline ✓/✗ confirm/deny slot at the box corner. */
  showConfirmDeny?: boolean;
  /**
   * Phase 9 (D-18/WR-05): whether this box was auto-detected by autofill. Drives
   * the canonical ConfirmDenyControls' origin-aware undo affordance (auto-detected
   * deny → Undo toast; user-drawn deny → no toast, geometry kept).
   */
  isAutoDetected?: boolean;
  /** Confirm callback for the inline ✓ control (D-16/D-17). */
  onConfirm?: (id: string) => void;
  /** Deny callback for the inline ✗ control (D-16/D-18). */
  onDeny?: (id: string) => void;
  /** Restore callback for the inline Undo (auto-detected deny, WR-01). */
  onRestore?: (id: string) => void;
}

/**
 * Role-color palette (D-10, 09-UI-SPEC §Color). When a role is set and the
 * region is not in a terminal (rejected/superseded) state, the role border/fill
 * REPLACES the default primary statusClasses. Selected adds a role-tinted ring.
 */
const ROLE_BORDER: Record<NonNullable<ComponentRole>, string> = {
  entity: "border-violet-500/80 bg-violet-500/10",
  field: "border-amber-500/80 bg-amber-500/10",
  unrelated: "border-slate-400/40 bg-slate-400/[0.06] opacity-60",
};

/** Selected-ring color per role (09-UI-SPEC §Canvas Selected row). */
const ROLE_SELECTED_RING: Record<NonNullable<ComponentRole>, string> = {
  entity: " ring-2 ring-violet-500/50",
  field: " ring-2 ring-amber-500/50",
  unrelated: " ring-2 ring-slate-400/50",
};

/** Hover border/fill per role (09-UI-SPEC §Canvas Hover row). */
const ROLE_HOVER: Record<NonNullable<ComponentRole>, string> = {
  entity: " hover:border-violet-500 hover:bg-violet-500/20",
  field: " hover:border-amber-500 hover:bg-amber-500/20",
  unrelated: " hover:border-slate-400 hover:bg-slate-400/20",
};

/** Label-chip tint per role (09-UI-SPEC §Canvas label chip). */
const ROLE_CHIP: Record<NonNullable<ComponentRole>, string> = {
  entity: "bg-violet-500 text-white",
  field: "bg-amber-500 text-white",
  unrelated: "bg-slate-400 text-white",
};

function getPolygon(
  location: unknown,
): ReadonlyArray<readonly [number, number]> | null {
  if (
    location !== null &&
    typeof location === "object" &&
    "polygon" in location &&
    Array.isArray((location as ComponentLocation).polygon) &&
    // Guard: empty array bypasses the overlay-layer hasPolygon check and
    // would produce Infinity CSS values via polygonToRect (CR-02)
    ((location as ComponentLocation).polygon?.length ?? 0) > 0
  ) {
    return (location as ComponentLocation).polygon ?? null;
  }
  return null;
}

function buildTooltipContent(
  entityTypeLabel: string | null,
  extractionStatus: string,
  extractedFields: unknown,
): string {
  const label = entityTypeLabel ?? extractionStatus;
  if (
    extractedFields !== null &&
    typeof extractedFields === "object" &&
    !Array.isArray(extractedFields)
  ) {
    const fields = extractedFields as Record<string, unknown>;
    const entries = Object.entries(fields);
    if (entries.length > 0) {
      const lines = entries.map(([k, v]) => `${k}: ${String(v)}`).join("\n");
      return `${label}\n${lines}`;
    }
  }
  return `${label}\nAwaiting extraction`;
}

export function RegionOverlayBox({
  component,
  pageSize,
  activeComponentId,
  setActiveComponentId,
  onSelectComponent,
  onShiftClick,
  isSelected = false,
  isMutating = false,
  isActiveParent = false,
  showConfirmDeny = false,
  isAutoDetected = false,
  onConfirm,
  onDeny,
  onRestore,
}: RegionOverlayBoxProps) {
  const polygon = getPolygon(component.location);

  // Guard: only render when polygon is present
  if (!polygon) return null;

  const rect = polygonToRect(polygon);

  const isActive = component.id === activeComponentId;

  // Status-differentiated styling (06-UI-SPEC §2):
  // pending = dashed/provisional; rejected/superseded = muted ghost;
  // candidate (default) = solid primary.
  const isTerminal =
    component.extractionStatus === "rejected" ||
    component.extractionStatus === "superseded";

  const statusClasses =
    component.extractionStatus === "pending"
      ? "border-primary/50 border-dashed bg-primary/[0.08]"
      : isTerminal
        ? "border-border/40 border-dashed bg-muted/50 opacity-40"
        : "border-primary/80 bg-primary/10";

  // Role-color override (D-10): when a role is set and the box is not terminal,
  // the role border/fill REPLACES the default primary statusClasses. Boxes with
  // no role fall back to the existing statusClasses (Phase 6/7 behavior intact).
  const role = component.role ?? null;
  const roleClass = role !== null && !isTerminal ? ROLE_BORDER[role] : null;
  const baseClass = roleClass ?? statusClasses;

  // Hover: role-tinted when a role is set, otherwise the primary hover.
  const hoverClass =
    role !== null && !isTerminal
      ? ROLE_HOVER[role]
      : " hover:border-primary hover:bg-primary/20";

  // Active (hover-tracked) — keep the existing primary ring for unclassified.
  const activeClasses =
    isActive && role === null
      ? " border-primary ring-2 ring-primary/40 bg-primary/20"
      : "";

  // Selected ring — role-tinted when classified, primary otherwise.
  const selectedClass = isSelected
    ? role !== null
      ? ROLE_SELECTED_RING[role]
      : " border-primary ring-2 ring-primary/50 bg-primary/25"
    : "";

  // Active-parent ENTITY box gets the outer violet glow (D-10).
  const activeParentClass = isActiveParent ? " ring-4 ring-violet-400/40" : "";

  const mutatingClass = isMutating ? " animate-pulse opacity-70" : "";

  const tooltipText = buildTooltipContent(
    component.entityTypeLabel,
    component.extractionStatus,
    component.extractedFields,
  );

  // B1: the box chip reads as the detected content, not the raw status. Prefer
  // the entity-type label, fall back to a snippet of the region's detected text,
  // and only show the status when there is no text at all.
  const labelText =
    component.entityTypeLabel ??
    contentSnippet(component.contentText) ??
    component.extractionStatus;
  const chipClass =
    role !== null ? ROLE_CHIP[role] : "bg-primary text-primary-foreground";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            style={{
              position: "absolute",
              left: rect.left * pageSize.width,
              top: rect.top * pageSize.height,
              width: rect.width * pageSize.width,
              height: rect.height * pageSize.height,
            }}
            className={`pointer-events-auto border-2 ${baseClass} rounded-sm${hoverClass} transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none cursor-pointer${activeClasses}${selectedClass}${activeParentClass}${mutatingClass}`}
            role="region"
            aria-label={`${role ? `${role}: ` : ""}${labelText} region`}
            aria-pressed={isSelected}
            aria-busy={isMutating}
            tabIndex={0}
            data-component-id={component.id}
            data-role={role ?? undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                onShiftClick?.(component.id);
              } else {
                onSelectComponent?.(component.id);
              }
            }}
            onMouseEnter={() => setActiveComponentId(component.id)}
            onMouseLeave={() => setActiveComponentId(null)}
            onFocus={() => setActiveComponentId(component.id)}
            onBlur={() => setActiveComponentId(null)}
          >
            {/* Label chip — pointer-events-none so the box stays interactive */}
            <span
              className={`absolute -top-5 left-0 text-xs font-semibold ${chipClass} px-2 py-0.5 rounded-sm whitespace-nowrap max-w-[160px] truncate pointer-events-none`}
            >
              {labelText}
            </span>

            {/* Inline ✓/✗ confirm/deny slot (D-16/D-17/D-18). Converged on the
                canonical ConfirmDenyControls (WR-01) — origin-aware deny + undo.
                Only rendered on candidate FIELD boxes via showConfirmDeny. */}
            {showConfirmDeny && onConfirm && onDeny && (
              <ConfirmDenyControls
                componentId={component.id}
                isAutoDetected={isAutoDetected}
                onConfirm={onConfirm}
                onDeny={onDeny}
                onRestore={onRestore}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
