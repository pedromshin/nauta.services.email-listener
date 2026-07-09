"use client";

import { useState } from "react";

import { Button } from "@polytoken/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@polytoken/ui/popover";
import { Skeleton } from "@polytoken/ui/skeleton";

import { api } from "~/trpc/react";

/** An ENTITY-role region eligible as a field's parent (same page). */
export interface ParentEntityOption {
  readonly id: string;
  readonly label: string;
  /** The parent entity's entity_type_id (drives the field-property list). */
  readonly entityTypeId: string | null;
  readonly entityTypeLabel: string | null;
}

interface FieldRelationshipPickerProps {
  /** Same-page ENTITY regions (06-04 pattern, computed by email-detail). */
  readonly parentOptions: readonly ParentEntityOption[];
  /** Current parent component id (if any). */
  readonly parentComponentId: string | null;
  /** Current entity-type-field id (if any). */
  readonly entityTypeFieldId: string | null;
  /** Persist the relationship (parent + property) via setFieldRelationship. */
  readonly onSelect: (
    parentComponentId: string | null,
    entityTypeFieldId: string | null,
  ) => void;
}

/**
 * FieldRelationshipPicker — parent-entity + field-property Popovers (D-04/D-11).
 *
 * Parent picker lists other ENTITY-role regions on the same page. Field-property
 * picker lazily fetches `entityTypes.list`, finds the selected parent's entity
 * type, and lists its fields — disabled until a parent is chosen. Selecting a
 * field persists `setFieldRelationship(parentComponentId, entityTypeFieldId)`.
 */
export function FieldRelationshipPicker({
  parentOptions,
  parentComponentId,
  entityTypeFieldId,
  onSelect,
}: FieldRelationshipPickerProps) {
  const [parentOpen, setParentOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  const selectedParent =
    parentOptions.find((p) => p.id === parentComponentId) ?? null;
  const parentEntityTypeId = selectedParent?.entityTypeId ?? null;

  // Lazy: only fetch the entity-type catalog once the property popover opens and
  // we actually have a parent entity type to resolve fields for.
  const { data: entityTypes, isLoading } = api.entityTypes.list.useQuery(
    undefined,
    { enabled: propertyOpen && parentEntityTypeId !== null },
  );

  const parentType =
    parentEntityTypeId !== null
      ? (entityTypes ?? []).find((et) => et.id === parentEntityTypeId)
      : undefined;
  const fields = parentType?.fields ?? [];

  const selectedFieldLabel =
    parentType?.fields.find((f) => f.id === entityTypeFieldId)?.label ?? null;

  return (
    <div className="space-y-3">
      {/* Parent entity picker */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parent entity
        </p>
        <Popover open={parentOpen} onOpenChange={setParentOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              aria-expanded={parentOpen}
            >
              {selectedParent?.label ?? "Select parent entity…"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" aria-label="Select parent entity">
            <div role="listbox" aria-label="Parent entities" className="space-y-1">
              {parentOptions.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No entity regions on this page.
                </p>
              )}
              {parentOptions.map((p) => (
                <button
                  key={p.id}
                  role="option"
                  aria-selected={p.id === parentComponentId}
                  className="w-full text-left rounded px-2 py-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => {
                    // Switching parent resets the property (different schema).
                    onSelect(p.id, null);
                    setParentOpen(false);
                  }}
                >
                  <span className="block text-sm font-semibold">{p.label}</span>
                  {p.entityTypeLabel !== null && (
                    <span className="block text-xs text-muted-foreground">
                      {p.entityTypeLabel}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Field property picker — disabled until a parent is chosen */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Field property
        </p>
        <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start"
              aria-expanded={propertyOpen}
              disabled={parentComponentId === null}
            >
              {selectedFieldLabel ?? "Select field property…"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" aria-label="Select field property">
            <div role="listbox" aria-label="Field properties" className="space-y-1">
              {parentComponentId === null && (
                <p className="text-sm text-muted-foreground py-2">
                  Select a parent entity first.
                </p>
              )}
              {parentComponentId !== null && isLoading && (
                <>
                  <Skeleton className="h-9 w-full rounded" />
                  <Skeleton className="h-9 w-full rounded" />
                  <Skeleton className="h-9 w-full rounded" />
                </>
              )}
              {parentComponentId !== null && !isLoading && fields.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No fields defined for this entity type.
                </p>
              )}
              {parentComponentId !== null &&
                !isLoading &&
                fields.map((f) => (
                  <button
                    key={f.id}
                    role="option"
                    aria-selected={f.id === entityTypeFieldId}
                    className="w-full text-left rounded px-2 py-1.5 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => {
                      onSelect(parentComponentId, f.id);
                      setPropertyOpen(false);
                    }}
                  >
                    <span className="block text-sm font-semibold">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {f.key}
                    </span>
                  </button>
                ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
