"use client";

import { Button } from "@polytoken/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@polytoken/ui/popover";

interface EligibleRegion {
  readonly id: string;
  readonly extractionStatus: string;
  readonly entityTypeLabel: string | null;
}

interface NestPickerComponent {
  readonly id: string;
  readonly parentComponentId: string | null;
}

interface NestPickerProps {
  readonly component: NestPickerComponent;
  readonly eligibleRegions: readonly EligibleRegion[];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onNest: (parentId: string) => void;
  readonly onUnNest: () => void;
}

/**
 * NestPicker — Popover that lists same-page eligible regions as nest targets.
 *
 * Per 06-PATTERNS §"nest-picker.tsx":
 * - Header "Nest into parent region"
 * - Ghost buttons per eligible region (label = entityTypeLabel ?? extractionStatus)
 * - Empty state "No other regions on this page to nest into."
 * - "Remove parent (un-nest)" only when component.parentComponentId is non-null
 */
export function NestPicker({
  component,
  eligibleRegions,
  open,
  onOpenChange,
  onNest,
  onUnNest,
}: NestPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Nest into parent region"
          aria-expanded={open}
        >
          ⤵ Nest into…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" aria-label="Select parent region">
        <p className="text-sm font-semibold pb-2">Nest into parent region</p>
        <div className="divide-y">
          {eligibleRegions.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No other regions on this page to nest into.
            </p>
          )}
          {eligibleRegions.map((r) => (
            <Button
              key={r.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onNest(r.id);
                onOpenChange(false);
              }}
            >
              {r.entityTypeLabel ?? r.extractionStatus}
            </Button>
          ))}
          {component.parentComponentId !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground w-full justify-start"
              onClick={() => {
                onUnNest();
                onOpenChange(false);
              }}
            >
              Remove parent (un-nest)
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
