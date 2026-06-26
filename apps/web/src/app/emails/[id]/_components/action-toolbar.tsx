"use client";

import { Button } from "@nauta/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@nauta/ui/tooltip";

import { EntityTypePicker } from "./entity-type-picker";
import { NestPicker } from "./nest-picker";
import { RejectDialog } from "./reject-dialog";

interface ToolbarComponent {
  readonly id: string;
  readonly sourceType: string;
  readonly extractionStatus: string;
  readonly entityTypeLabel: string | null;
  readonly location: unknown;
  readonly parentComponentId: string | null;
}

interface EligibleRegion {
  readonly id: string;
  readonly extractionStatus: string;
  readonly entityTypeLabel: string | null;
}

interface ActionToolbarProps {
  readonly selectedComponentIds: readonly string[];
  readonly components: ToolbarComponent[];
  readonly onAccept: (id: string) => void;
  readonly onRedraw: () => void;
  readonly onSplit: () => void;
  readonly onMerge?: (ids: readonly string[]) => void;
  readonly onNest?: (componentId: string, parentId: string) => void;
  readonly onUnNest?: (componentId: string) => void;
  readonly onRejectConfirm: (id: string) => void;
  /** Controlled open state for the reject dialog (from useRegionEdit). */
  readonly rejectDialogOpen: boolean;
  readonly onRejectDialogChange: (open: boolean) => void;
  /** Controlled open state for the nest picker (from useRegionEdit). */
  readonly nestPickerOpen: boolean;
  readonly onNestPickerChange: (open: boolean) => void;
  /** Eligible regions for nesting (same page, not selected, not rejected/superseded). */
  readonly eligibleRegions: readonly EligibleRegion[];
  /** Disables every button (e.g. while draw mode is active). */
  readonly disabled?: boolean;
  /** Called when user selects an entity type from the picker (componentId, entityTypeSlug). */
  readonly onAutofill?: (componentId: string, entityTypeSlug: string) => void;
  /** Controlled open state for the autofill entity-type picker. */
  readonly autofillPickerOpen?: boolean;
  readonly onAutofillPickerChange?: (open: boolean) => void;
  /** When true, all toolbar buttons are disabled during AI extraction. */
  readonly autofillExtracting?: boolean;
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

/**
 * ActionToolbar — floating region action bar (06-UI-SPEC §3.2 / §6.1).
 *
 * Rendered below the pane toolbar; the parent CSS-hides it (display:none,
 * not unmount) when nothing is selected.
 *
 * Reject now opens RejectDialog (controlled by rejectDialogOpen / onRejectDialogChange).
 * Merge enters multi-select when 1 selected; fires mutation when ≥2 selected.
 * Nest opens NestPicker Popover anchored to the Nest button.
 */
export function ActionToolbar({
  selectedComponentIds,
  components,
  onAccept,
  onRedraw,
  onSplit,
  onMerge,
  onNest,
  onUnNest,
  onRejectConfirm,
  rejectDialogOpen,
  onRejectDialogChange,
  nestPickerOpen,
  onNestPickerChange,
  eligibleRegions,
  disabled = false,
  onAutofill,
  autofillPickerOpen = false,
  onAutofillPickerChange,
  autofillExtracting = false,
}: ActionToolbarProps) {
  const allDisabled = disabled || autofillExtracting;
  const selectedCount = selectedComponentIds.length;
  const single =
    selectedCount === 1
      ? (components.find((c) => c.id === selectedComponentIds[0]) ?? null)
      : null;

  const status = single?.extractionStatus ?? null;
  const isTerminal = status === "rejected" || status === "superseded";
  const singlePageIndex = single ? getPageIndex(single.location) : null;

  const contextLabel =
    selectedCount >= 2
      ? `${selectedCount} regions selected`
      : single
        ? `Selected: ${single.entityTypeLabel ?? single.extractionStatus} · Page ${(singlePageIndex ?? 0) + 1}`
        : "";

  // Merge logic: 1 selected → enter multi-select (no submit yet), ≥2 → fire mutation
  const isMergeMultiSelect = selectedCount >= 2;
  const mergeEnabled = isMergeMultiSelect && !!onMerge;

  // Nest: only enabled when ≥1 eligible region and onNest provided
  const nestEnabled = !!single && eligibleRegions.length > 0 && !!onNest;

  function handleRejectClick() {
    if (!single) return;
    onRejectDialogChange(true);
  }

  function handleRejectConfirm() {
    if (!single) return;
    onRejectConfirm(single.id);
    onRejectDialogChange(false);
  }

  function handleMergeClick() {
    if (isMergeMultiSelect && onMerge) {
      onMerge(selectedComponentIds);
    }
    // If only 1 selected, Merge click enters multi-select mode (visual hint).
    // The parent tracks selectedComponentIds — subsequent shift-clicks will add.
  }

  function handleNestSelect(parentId: string) {
    if (single && onNest) {
      onNest(single.id, parentId);
    }
  }

  function handleUnNest() {
    if (single && onUnNest) {
      onUnNest(single.id);
    }
  }

  return (
    <TooltipProvider>
      {/* RejectDialog — controlled; confirm fires onRejectConfirm */}
      {single && (
        <RejectDialog
          open={rejectDialogOpen}
          onOpenChange={onRejectDialogChange}
          onConfirm={handleRejectConfirm}
        />
      )}

      <div
        className="flex flex-wrap items-center gap-2 border-b px-4 py-2 bg-card"
        role="toolbar"
        aria-label="Region actions"
        aria-controls="region-overlay-layer"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              aria-label="Accept region"
              aria-keyshortcuts="a"
              disabled={allDisabled || !single || status !== "pending"}
              onClick={() => single && onAccept(single.id)}
            >
              ✓ Accept Region
            </Button>
          </TooltipTrigger>
          <TooltipContent>Accept region (A)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              aria-label="Reject region"
              aria-keyshortcuts="Delete"
              disabled={
                allDisabled ||
                !single ||
                (status !== "pending" && status !== "candidate")
              }
              onClick={handleRejectClick}
            >
              ✗ Reject Region
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reject region (Del)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Redraw region"
              disabled={allDisabled || !single || isTerminal}
              onClick={onRedraw}
            >
              ↩ Redraw Region
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redraw region</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Split region"
              disabled={allDisabled || !single || isTerminal}
              onClick={onSplit}
            >
              ÷ Split Region
            </Button>
          </TooltipTrigger>
          <TooltipContent>Split into sub-regions</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={mergeEnabled ? "default" : "outline"}
              size="sm"
              aria-label="Merge selected regions"
              disabled={allDisabled || selectedCount < 1 || (isMergeMultiSelect && !onMerge)}
              onClick={handleMergeClick}
            >
              ⊕ Merge Regions
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isMergeMultiSelect ? "Merge selected" : "Click again to add more selections"}
          </TooltipContent>
        </Tooltip>

        {/* NestPicker renders as a Popover; the trigger is inside it */}
        {single ? (
          <NestPicker
            component={{
              id: single.id,
              parentComponentId: single.parentComponentId,
            }}
            eligibleRegions={eligibleRegions}
            open={nestPickerOpen}
            onOpenChange={nestEnabled ? onNestPickerChange : (v) => { if (!v) onNestPickerChange(false); }}
            onNest={handleNestSelect}
            onUnNest={handleUnNest}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Nest into parent region"
                disabled
              >
                ⤵ Nest into…
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nest into parent</TooltipContent>
          </Tooltip>
        )}

        {/* Autofill button — per 07-UI-SPEC §3.1 */}
        {single && status === "candidate" && onAutofill !== undefined && (
          <EntityTypePicker
            open={autofillPickerOpen}
            onOpenChange={onAutofillPickerChange ?? (() => undefined)}
            onSelect={(slug) => onAutofill(single.id, slug)}
            trigger={
              <Button
                variant="outline"
                size="sm"
                aria-label="Autofill Fields"
                aria-expanded={autofillPickerOpen}
                disabled={allDisabled}
                onClick={() => onAutofillPickerChange?.(!autofillPickerOpen)}
              >
                ✦ Autofill Fields
              </Button>
            }
          />
        )}
        {single && status === "pending" && onAutofill !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Autofill Fields"
                disabled
              >
                ✦ Autofill Fields
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept the region first</TooltipContent>
          </Tooltip>
        )}
        {single && isTerminal && onAutofill !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Autofill Fields"
                disabled
              >
                ✦ Autofill Fields
              </Button>
            </TooltipTrigger>
            <TooltipContent>Region is not active</TooltipContent>
          </Tooltip>
        )}

        {contextLabel && (
          <span className="text-xs text-muted-foreground">{contextLabel}</span>
        )}
      </div>
    </TooltipProvider>
  );
}
