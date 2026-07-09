"use client";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@polytoken/ui/card";
import { Checkbox } from "@polytoken/ui/checkbox";
import { ScrollArea } from "@polytoken/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@polytoken/ui/tooltip";

import { FieldsPanel } from "./fields-panel";
import { getStatusBadge } from "./status-badge";

interface Component {
  readonly id: string;
  readonly attachmentId: string | null;
  readonly sourceType: string;
  readonly extractionStatus: string;
  // location is a JSONB column — Drizzle returns it as `unknown`; we narrow it before use
  readonly location: unknown;
  readonly entityTypeLabel: string | null;
  readonly entityTypeSlug: string | null;
  // Extraction fields — present after autofill (07-01 added to emails.detail)
  // Typed as unknown to accept the raw API shape; narrowed at point of use.
  readonly extractedFields?: unknown;
  readonly correctedFields?: unknown;
  readonly confidenceScore?: unknown;
  readonly confidenceBreakdown?: unknown;
  readonly extractionRecordStatus?: string | null;
}

interface Attachment {
  id: string;
  filename: string;
}

interface EntitiesListProps {
  components: Component[];
  attachments: Attachment[];
  activeComponentId: string | null;
  onSelectComponent: (
    componentId: string,
    pageIndex: number,
    attachmentId: string | null,
  ) => void;
  onHoverComponent: (componentId: string | null) => void;
  /** Called when the user clicks "+ Add region" to enter draw mode. */
  onAddRegion?: () => void;
  /** True when no attachment is open; disables the Add region button. */
  addDisabled?: boolean;
  /** Controlled IDs selected for merge multi-select mode. */
  selectedComponentIds?: readonly string[];
  /** Toggle a component in/out of the merge selection. */
  onToggleSelect?: (id: string) => void;
  /** When true, rejected/superseded rows are visible (history view). */
  showHistory?: boolean;
  /** Autofill phase per component ID (07-03). */
  autofillPhases?: Record<string, string>;
  /** Field values per component ID for the inline fields panel (07-03). */
  fieldValues?: Record<string, Record<string, string>>;
  /** Entity type field definitions keyed by entityTypeSlug (07-03). */
  entityTypeFieldsMap?: Record<
    string,
    ReadonlyArray<{ key: string; label: string; isRequired: boolean }>
  >;
  /** Called when a field value changes in the inline panel (07-03). */
  onFieldChange?: (componentId: string, key: string, value: string) => void;
  /** Called when the user confirms extracted fields (07-03). */
  onConfirmFields?: (componentId: string) => void;
  /** Called when the user discards extracted fields (07-03). */
  onDiscardFields?: (componentId: string) => void;
}

export function EntitiesList({
  components,
  attachments,
  activeComponentId,
  onSelectComponent,
  onHoverComponent,
  onAddRegion,
  addDisabled = false,
  selectedComponentIds = [],
  onToggleSelect,
  showHistory = false,
  autofillPhases,
  fieldValues,
  entityTypeFieldsMap,
  onFieldChange,
  onConfirmFields,
  onDiscardFields,
}: EntitiesListProps) {
  const allRegions = components.filter((c) => c.sourceType === "region");

  // Filter out rejected/superseded unless showHistory is on
  const visibleRegions = showHistory
    ? allRegions
    : allRegions.filter(
        (c) =>
          c.extractionStatus !== "rejected" &&
          c.extractionStatus !== "superseded",
      );

  const isMergeMultiSelect = selectedComponentIds.length >= 1 && !!onToggleSelect;

  function getAttachmentFilename(attachmentId: string | null): string {
    if (!attachmentId) return "unknown";
    return (
      attachments.find((a) => a.id === attachmentId)?.filename ?? "unknown"
    );
  }

  function getPageIndex(location: unknown): number {
    if (
      location !== null &&
      typeof location === "object" &&
      "page_index" in location &&
      typeof (location as { page_index?: unknown }).page_index === "number"
    ) {
      return (location as { page_index: number }).page_index;
    }
    return 0;
  }

  const addRegionButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={addDisabled || !onAddRegion}
              onClick={() => onAddRegion?.()}
              aria-label="Add region"
            >
              + Add region
            </Button>
          </span>
        </TooltipTrigger>
        {addDisabled && (
          <TooltipContent>Open a PDF to draw regions.</TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );

  if (visibleRegions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Detected Regions</CardTitle>
          {addRegionButton}
        </CardHeader>
        <CardContent className="text-muted-foreground py-8 text-center text-sm space-y-2">
          <p className="text-foreground font-semibold">
            {showHistory || allRegions.length === 0
              ? "No detected regions yet"
              : "No active regions"}
          </p>
          <p>
            {allRegions.length === 0
              ? "Document segmentation is pending. Regions will appear here once processing completes."
              : "All regions are rejected or superseded. Toggle 'Show history' to view them."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Detected Regions</CardTitle>
        {addRegionButton}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          <ul role="list" className="divide-y">
            {visibleRegions.map((component) => {
              const isActive = component.id === activeComponentId;
              const isChecked = selectedComponentIds.includes(component.id);
              const pageIndex = getPageIndex(component.location);
              const label =
                component.entityTypeLabel ?? component.extractionStatus;
              const filename = getAttachmentFilename(component.attachmentId);
              const { variant: badgeVariant, className: badgeClass } =
                getStatusBadge(component.extractionStatus);

              const phase = autofillPhases?.[component.id];
              const shouldShowPanel =
                phase === "extracting" ||
                phase === "reviewing" ||
                phase === "confirming" ||
                phase === "confirmed";

              const panelPhase =
                phase === "extracting" ||
                phase === "reviewing" ||
                phase === "confirming" ||
                phase === "confirmed"
                  ? (phase as "extracting" | "reviewing" | "confirming" | "confirmed")
                  : null;

              const panelFields =
                entityTypeFieldsMap?.[component.entityTypeSlug ?? ""] ?? [];

              return (
                <li key={component.id} role="listitem" className="flex flex-col">
                  {/* Row: checkbox (merge mode) + region button */}
                  <div className="flex items-center w-full">
                    {/* Leading checkbox — only visible in merge multi-select mode */}
                    {isMergeMultiSelect && (
                      <span className="pl-3 py-3 flex-shrink-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onToggleSelect?.(component.id)}
                          aria-label={`Select ${label} for merge`}
                        />
                      </span>
                    )}
                    <button
                      type="button"
                      className={[
                        "flex-1 px-4 py-3 text-left transition-colors",
                        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
                        isActive ? "bg-muted ring-2 ring-inset ring-primary/30" : "",
                        isMergeMultiSelect && isChecked ? "bg-muted/50" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={isActive}
                      onClick={() =>
                        onSelectComponent(
                          component.id,
                          pageIndex,
                          component.attachmentId,
                        )
                      }
                      onMouseEnter={() => onHoverComponent(component.id)}
                      onMouseLeave={() => onHoverComponent(null)}
                      onFocus={() => onHoverComponent(component.id)}
                      onBlur={() => onHoverComponent(null)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{label}</span>
                        <Badge
                          variant={badgeVariant}
                          className={["shrink-0 text-xs", badgeClass]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {component.extractionStatus}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Attachment: {filename} · Page {pageIndex + 1}
                      </p>
                    </button>
                  </div>
                  {/* Inline fields panel — visible when autofill phase warrants it */}
                  {shouldShowPanel && panelPhase !== null && (
                    <FieldsPanel
                      phase={panelPhase}
                      entityTypeLabel={
                        component.entityTypeLabel ?? component.entityTypeSlug ?? "Unknown"
                      }
                      extractionRecordStatus={
                        component.extractionRecordStatus ?? null
                      }
                      confidenceScore={
                        typeof component.confidenceScore === "number"
                          ? component.confidenceScore
                          : typeof component.confidenceScore === "string"
                            ? parseFloat(component.confidenceScore) || null
                            : null
                      }
                      fields={panelFields}
                      extractedFields={
                        component.extractedFields !== null &&
                        typeof component.extractedFields === "object"
                          ? (component.extractedFields as Record<string, unknown>)
                          : {}
                      }
                      correctedFields={
                        component.correctedFields !== null &&
                        typeof component.correctedFields === "object"
                          ? (component.correctedFields as Record<string, unknown>)
                          : null
                      }
                      confidenceBreakdown={
                        component.confidenceBreakdown !== null &&
                        typeof component.confidenceBreakdown === "object"
                          ? (component.confidenceBreakdown as Record<string, unknown>)
                          : null
                      }
                      fieldValues={fieldValues?.[component.id] ?? {}}
                      onFieldChange={(key, value) =>
                        onFieldChange?.(component.id, key, value)
                      }
                      onConfirm={() => onConfirmFields?.(component.id)}
                      onDiscard={() => onDiscardFields?.(component.id)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
