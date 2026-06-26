"use client";

import { useState } from "react";

import { Button } from "@nauta/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nauta/ui/popover";
import { Skeleton } from "@nauta/ui/skeleton";

import { api } from "~/trpc/react";

// ---- Props ----

interface EntityTypePickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (entityTypeSlug: string) => void;
  readonly trigger: React.ReactNode;
}

/**
 * EntityTypePicker — Controlled Popover that lists active entity types.
 *
 * Fetches entity types via api.entityTypes.list on first open.
 * Per 07-UI-SPEC §3.2:
 * - Width: w-72
 * - Heading: "Select entity type"
 * - Loading: 3 Skeleton rows
 * - Empty state: "No entity types available."
 * - Rows: button with label + description, role="option", aria-selected="false"
 * - Container: role="listbox"
 */
export function EntityTypePicker({
  open,
  onOpenChange,
  onSelect,
  trigger,
}: EntityTypePickerProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: entityTypes, isLoading } = api.entityTypes.list.useQuery(
    undefined,
    { enabled: open },
  );

  function handleSelect(slug: string): void {
    setSelectedSlug(slug);
    onSelect(slug);
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        aria-label="Select entity type"
      >
        <p className="text-sm font-semibold pb-2">Select entity type</p>
        <div role="listbox" aria-label="Entity types" className="space-y-1">
          {isLoading && (
            <>
              <Skeleton className="h-9 w-full rounded" />
              <Skeleton className="h-9 w-full rounded" />
              <Skeleton className="h-9 w-full rounded" />
            </>
          )}
          {!isLoading && entityTypes !== undefined && entityTypes.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No entity types available.
            </p>
          )}
          {!isLoading &&
            entityTypes !== undefined &&
            entityTypes.map((et) => (
              <button
                key={et.slug}
                role="option"
                aria-selected={et.slug === selectedSlug}
                onClick={() => handleSelect(et.slug)}
                className="w-full text-left rounded px-2 py-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="block text-sm font-medium">{et.label}</span>
                {et.description !== null && (
                  <span className="block text-xs text-muted-foreground">
                    {et.description}
                  </span>
                )}
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
