"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ScrollArea } from "@nauta/ui/scroll-area";

import { LayersTreeRow } from "./layers-tree-row";

import type { ComponentRole } from "./region-overlay-box";

/** The component shape the LAYERS panel consumes (subset of emails.detail). */
export interface LayersComponent {
  readonly id: string;
  readonly sourceType: string;
  readonly role: ComponentRole;
  readonly parentComponentId: string | null;
  readonly entityTypeLabel: string | null;
  readonly entityTypeFieldId: string | null;
  readonly extractionStatus: string;
  readonly location: unknown;
  /** Detected region text — primary label for UNCLASSIFIED rows (B1). */
  readonly contentText: string | null;
  /** AI candidate value for a FIELD (auto-escaped React text node — T-09-80). */
  readonly candidateValue: string | null;
  /** Resolved property label for a FIELD (entity-type-field label). */
  readonly propertyLabel: string | null;
}

interface LayersPanelProps {
  readonly components: readonly LayersComponent[];
  /** Selected/active component id (drives selection + active-parent). */
  readonly selectedId: string | null;
  /** The currently-armed active parent entity (D-10). */
  readonly activeParentId: string | null;
  /** Reveal UNRELATED rows (toolbar toggle, D-12 default off). */
  readonly showUnrelated: boolean;
  /** Select a row → drives selection + active-parent in the consumer. */
  readonly onSelect: (id: string) => void;
  /** Inline ✓ on a candidate FIELD row (D-16/D-17). */
  readonly onConfirmField: (id: string) => void;
  /** Inline ✗ on a candidate FIELD row (D-16/D-18). */
  readonly onDenyField: (id: string) => void;
}

function getPageNumber(location: unknown): number {
  if (
    location !== null &&
    typeof location === "object" &&
    "page_index" in location &&
    typeof (location as { page_index?: unknown }).page_index === "number"
  ) {
    return (location as { page_index: number }).page_index + 1;
  }
  return 1;
}

/** A FIELD row is "populated/related" (D-12) when it has a value or a property. */
function isPopulatedField(c: LayersComponent): boolean {
  return c.candidateValue !== null || c.entityTypeFieldId !== null;
}

/**
 * LayersPanel — the entities-first tree (D-06/D-12, 09-UI-SPEC §LAYERS Panel).
 *
 * Visibility rules (D-12 anti-bloat):
 *   - FOCUS MODE (B3): when an entity is the active parent, the tree shows ONLY
 *     that entity + its field children; every other/unclassified/unrelated row
 *     is hidden until the active parent is cleared.
 *   - Otherwise ENTITY rows render at the top; UNCLASSIFIED rows are collapsed
 *     behind a count/expander (B2) so 30+ raw proposals never break the layout.
 *   - FIELD rows render only under an EXPANDED parent entity (reveal-on-select);
 *     a parent is auto-expanded when it is selected/active.
 *   - UNRELATED rows hide unless the Unrelated toggle is on.
 *   - Only populated/related FIELDs show (never full schema enumeration).
 */
export function LayersPanel({
  components,
  selectedId,
  activeParentId,
  showUnrelated,
  onSelect,
  onConfirmField,
  onDenyField,
}: LayersPanelProps) {
  // Manually-toggled expansion state, keyed by entity id. A selected/active
  // entity is implicitly expanded (see isExpanded below).
  const [expandedIds, setExpandedIds] = useState<readonly string[]>([]);
  // B2: the raw unclassified proposal list is collapsed by default.
  const [unclassifiedOpen, setUnclassifiedOpen] = useState(false);

  const regions = components.filter((c) => c.sourceType === "region");
  const visible = regions.filter(
    (c) => c.extractionStatus !== "rejected" && c.extractionStatus !== "superseded",
  );

  // B3 focus mode: an armed active parent narrows the tree to that entity only.
  // Gate on the entity actually being visible so a stale activeParentId (e.g. the
  // entity was just superseded) gracefully falls back to the full tree instead of
  // hiding everything and showing the empty "No regions yet" state.
  const focusMode =
    activeParentId !== null &&
    visible.some((c) => c.role === "entity" && c.id === activeParentId);

  const entities = focusMode
    ? visible.filter((c) => c.role === "entity" && c.id === activeParentId)
    : visible.filter((c) => c.role === "entity");
  const unclassified = focusMode
    ? []
    : visible.filter((c) => c.role === null || c.role === undefined);
  const unrelated = focusMode
    ? []
    : visible.filter((c) => c.role === "unrelated");

  const fieldsByParent = new Map<string, LayersComponent[]>();
  for (const c of visible) {
    if (c.role !== "field") continue;
    if (!isPopulatedField(c)) continue;
    if (c.parentComponentId === null) continue;
    const bucket = fieldsByParent.get(c.parentComponentId) ?? [];
    bucket.push(c);
    fieldsByParent.set(c.parentComponentId, bucket);
  }

  function toggleExpand(id: string): void {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const hasRows =
    entities.length > 0 ||
    unclassified.length > 0 ||
    (showUnrelated && unrelated.length > 0);

  if (!hasRows) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-sm font-semibold px-3 py-2 border-b bg-background shrink-0">
          Regions
        </div>
        <div className="py-12 px-4 text-center text-sm text-muted-foreground space-y-1">
          <p className="text-foreground font-semibold">No regions yet</p>
          <p>
            Draw a rectangle on the document to define your first region.
          </p>
        </div>
      </div>
    );
  }

  return (
    <nav
      className="flex flex-col h-full"
      role="navigation"
      aria-label="Regions layers"
    >
      <div className="text-sm font-semibold px-3 py-2 border-b bg-background shrink-0">
        Regions
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div role="tree" aria-label="Entity and field regions">
          {entities.map((entity) => {
            const children = fieldsByParent.get(entity.id) ?? [];
            const isExpanded =
              expandedIds.includes(entity.id) ||
              entity.id === activeParentId ||
              entity.id === selectedId;
            return (
              <div key={entity.id}>
                <LayersTreeRow
                  kind="entity"
                  component={{
                    id: entity.id,
                    role: entity.role,
                    entityTypeLabel: entity.entityTypeLabel,
                    extractionStatus: entity.extractionStatus,
                    candidateValue: null,
                    propertyLabel: null,
                    contentText: entity.contentText,
                    pageNumber: getPageNumber(entity.location),
                  }}
                  isSelected={entity.id === selectedId}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(entity.id)}
                  onSelect={() => onSelect(entity.id)}
                />
                {isExpanded &&
                  children.map((field) => (
                    <LayersTreeRow
                      key={field.id}
                      kind="field"
                      component={{
                        id: field.id,
                        role: field.role,
                        entityTypeLabel: field.entityTypeLabel,
                        extractionStatus: field.extractionStatus,
                        candidateValue: field.candidateValue,
                        propertyLabel: field.propertyLabel,
                        contentText: field.contentText,
                        pageNumber: getPageNumber(field.location),
                      }}
                      isSelected={field.id === selectedId}
                      onSelect={() => onSelect(field.id)}
                      onConfirm={() => onConfirmField(field.id)}
                      onDeny={() => onDenyField(field.id)}
                    />
                  ))}
              </div>
            );
          })}

          {/* B2: collapse the raw unclassified proposals behind a count/expander
              (default closed) so the entities lead and 30+ rows never break the
              sidebar layout. Hidden entirely in focus mode (unclassified === []). */}
          {unclassified.length > 0 && (
            <div>
              <button
                type="button"
                aria-expanded={unclassifiedOpen}
                className="flex w-full items-center gap-2 py-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                onClick={() => setUnclassifiedOpen((prev) => !prev)}
              >
                {unclassifiedOpen ? (
                  <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span className="flex-1 text-left">Unclassified</span>
                <span className="shrink-0 normal-case tabular-nums">
                  {unclassified.length}
                </span>
              </button>
              {unclassifiedOpen &&
                unclassified.map((c) => (
                  <LayersTreeRow
                    key={c.id}
                    kind="unclassified"
                    component={{
                      id: c.id,
                      role: c.role,
                      entityTypeLabel: c.entityTypeLabel,
                      extractionStatus: c.extractionStatus,
                      candidateValue: null,
                      propertyLabel: null,
                      contentText: c.contentText,
                      pageNumber: getPageNumber(c.location),
                    }}
                    isSelected={c.id === selectedId}
                    onSelect={() => onSelect(c.id)}
                  />
                ))}
            </div>
          )}

          {showUnrelated &&
            unrelated.map((c) => (
              <LayersTreeRow
                key={c.id}
                kind="unclassified"
                component={{
                  id: c.id,
                  role: c.role,
                  entityTypeLabel: c.entityTypeLabel ?? "Unrelated",
                  extractionStatus: c.extractionStatus,
                  candidateValue: null,
                  propertyLabel: null,
                  contentText: c.contentText,
                  pageNumber: getPageNumber(c.location),
                }}
                isSelected={c.id === selectedId}
                onSelect={() => onSelect(c.id)}
              />
            ))}
        </div>
      </ScrollArea>
    </nav>
  );
}
