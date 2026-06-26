"use client";

import { RegionOverlayBox } from "./region-overlay-box";

import type { ComponentRole } from "./region-overlay-box";

interface Component {
  readonly id: string;
  readonly attachmentId: string | null;
  readonly sourceType: string;
  readonly contentText: string | null;
  readonly extractionStatus: string;
  readonly location: unknown;
  readonly entityTypeLabel: string | null;
  readonly entityTypeSlug: string | null;
  readonly extractedFields: unknown;
  readonly confidenceScore: unknown;
  /** Phase 9 (D-10): relationship role. Optional for back-compat. */
  readonly role?: ComponentRole;
  /** Phase 9 (D-04/D-12): parent ENTITY component for FIELD boxes. */
  readonly parentComponentId?: string | null;
}

interface PageSize {
  width: number;
  height: number;
}

interface OverlayLayerProps {
  components: Component[];
  currentPage: number;
  pageSize: PageSize | null;
  activeComponentId: string | null;
  setActiveComponentId: (id: string | null) => void;
  showHistory?: boolean;
  selectedComponentIds?: readonly string[];
  onSelectComponent?: (id: string) => void;
  onShiftClick?: (id: string) => void;
  mutatingComponentIds?: readonly string[];
  /**
   * Phase 9 (D-10/D-12): the currently-armed active parent ENTITY id. FIELD
   * boxes are revealed only when their parent === activeParentId; the matching
   * entity box draws the active-parent ring.
   */
  readonly activeParentId?: string | null;
  /**
   * Phase 9 (D-12): explicit single-role filter. When set, ONLY boxes of this
   * role render (overrides the default anti-bloat visibility). null = default.
   */
  readonly roleFilter?: ComponentRole;
  /** Phase 9 (D-05/D-12): reveal UNRELATED boxes (toolbar toggle, default off). */
  readonly showUnrelated?: boolean;
  /** Phase 9 (D-16): components for which the inline ✓/✗ slot should render. */
  readonly confirmDenyComponentIds?: readonly string[];
  /**
   * Phase 9 (D-18/WR-05): component ids that were auto-detected by autofill.
   * Drives the canonical control's origin-aware undo (auto-detected → Undo toast).
   */
  readonly autoDetectedComponentIds?: readonly string[];
  /** Confirm callback for the inline ✓ control (D-16/D-17). */
  readonly onConfirmField?: (id: string) => void;
  /** Deny callback for the inline ✗ control (D-16/D-18). */
  readonly onDenyField?: (id: string) => void;
  /** Restore callback for the inline Undo of an auto-detected deny (WR-01). */
  readonly onRestoreField?: (id: string) => void;
}

/**
 * D-12 anti-bloat visibility decision for a single classified box.
 *
 * Focus mode (B3, activeParentId set, no roleFilter):
 *   - Show ONLY the active entity and its FIELD children; hide every other
 *     entity / unclassified / unrelated box until the active parent is cleared.
 *
 * Default (activeParentId null, roleFilter null):
 *   - ENTITY + unclassified boxes show; FIELD boxes are hidden (revealed only by
 *     arming their parent); UNRELATED boxes hide unless showUnrelated.
 *
 * roleFilter set: show ONLY boxes whose role matches the filter.
 */
function isRoleVisible(
  component: Component,
  roleFilter: ComponentRole | undefined,
  activeParentId: string | null | undefined,
  showUnrelated: boolean,
): boolean {
  const role = component.role ?? null;

  if (roleFilter !== undefined && roleFilter !== null) {
    return role === roleFilter;
  }

  // B3 focus mode: an armed active parent narrows the canvas to that entity +
  // its fields only — everything unrelated disappears.
  if (activeParentId != null) {
    if (component.id === activeParentId) return true;
    return role === "field" && component.parentComponentId === activeParentId;
  }

  if (role === "unrelated") return showUnrelated;
  // No active parent: fields stay hidden until their parent entity is armed.
  if (role === "field") return false;
  // entity + unclassified (null) always visible by default.
  return true;
}

function getPageIndex(location: unknown): number | null {
  if (
    location !== null &&
    typeof location === "object" &&
    "page_index" in location &&
    typeof (location as { page_index?: unknown }).page_index === "number"
  ) {
    return (location as { page_index: number }).page_index;
  }
  return null;
}

function hasPolygon(location: unknown): boolean {
  if (
    location !== null &&
    typeof location === "object" &&
    "polygon" in location
  ) {
    const poly = (location as { polygon?: unknown }).polygon;
    return Array.isArray(poly) && poly.length > 0;
  }
  return false;
}

export function OverlayLayer({
  components,
  currentPage,
  pageSize,
  activeComponentId,
  setActiveComponentId,
  showHistory = false,
  selectedComponentIds = [],
  onSelectComponent,
  onShiftClick,
  mutatingComponentIds = [],
  activeParentId = null,
  roleFilter = null,
  showUnrelated = false,
  confirmDenyComponentIds = [],
  autoDetectedComponentIds = [],
  onConfirmField,
  onDenyField,
  onRestoreField,
}: OverlayLayerProps) {
  // Guard: do not render before page has measured dimensions
  if (pageSize === null) return null;

  // B3 staleness guard (mirrors the LayersPanel focusMode gate): only engage
  // focus mode when the armed entity is actually present AND non-terminal. A
  // stale activeParentId (its entity was just superseded/rejected) falls back to
  // the default view so the canvas and the LAYERS tree never disagree.
  const focusActiveParentId =
    activeParentId != null &&
    components.some(
      (c) =>
        (c.role ?? null) === "entity" &&
        c.id === activeParentId &&
        c.extractionStatus !== "rejected" &&
        c.extractionStatus !== "superseded",
    )
      ? activeParentId
      : null;

  // Filter: source_type==="region", polygon present, page_index matches
  // currentPage - 1, and (Phase 6) rejected/superseded hidden unless showHistory.
  // Phase 9 (D-12): layer the role-visibility rules on top of the Phase 6 filters.
  const overlays = components.filter((c) => {
    if (c.sourceType !== "region") return false;
    if (!hasPolygon(c.location)) return false;
    const pageIndex = getPageIndex(c.location);
    if (pageIndex !== currentPage - 1) return false;
    if (
      !showHistory &&
      (c.extractionStatus === "rejected" || c.extractionStatus === "superseded")
    ) {
      return false;
    }
    // D-12 anti-bloat role visibility (history view shows everything).
    if (
      !showHistory &&
      !isRoleVisible(c, roleFilter, focusActiveParentId, showUnrelated)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div
      id="region-overlay-layer"
      // z-10 lifts the overlay above react-pdf's .textLayer (z-index: 2), which
      // otherwise paints over the boxes and swallows every click/hover. The
      // container stays pointer-events-none so gaps fall through to the text
      // layer for selection; only the boxes (pointer-events-auto) capture events.
      className="absolute inset-0 z-10 pointer-events-none"
      style={{ width: pageSize.width, height: pageSize.height }}
      role="group"
      aria-label="Detected region overlays"
    >
      {overlays.map((c) => (
        <RegionOverlayBox
          key={c.id}
          component={c}
          pageSize={pageSize}
          activeComponentId={activeComponentId}
          setActiveComponentId={setActiveComponentId}
          onSelectComponent={onSelectComponent}
          onShiftClick={onShiftClick}
          isSelected={selectedComponentIds.includes(c.id)}
          isMutating={mutatingComponentIds.includes(c.id)}
          isActiveParent={activeParentId != null && c.id === activeParentId}
          showConfirmDeny={confirmDenyComponentIds.includes(c.id)}
          isAutoDetected={autoDetectedComponentIds.includes(c.id)}
          onConfirm={onConfirmField}
          onDeny={onDenyField}
          onRestore={onRestoreField}
        />
      ))}
    </div>
  );
}
