"use client";

/**
 * graph-states.tsx — Error + no-schema state components for the /knowledge surface.
 *
 * UI-SPEC States:
 *   GraphErrorState: AlertCircle size-8 text-destructive,
 *     "Could not load the knowledge graph." text-base font-semibold,
 *     "Try refreshing the page." text-sm text-muted-foreground,
 *     "Refresh page" variant="outline" size="sm" → window.location.reload()
 *     role="alert"
 *
 *   GraphNoSchemaState: Shapes size-8 text-muted-foreground,
 *     "No schema defined yet." text-base font-semibold,
 *     "Add entity types to see your knowledge network." text-sm text-muted-foreground,
 *     no button (entity type creation is out of scope per D-09)
 *
 * No font-medium (500) — only font-normal / font-semibold.
 */

import { AlertCircle, Shapes } from "lucide-react";

import { Button } from "@polytoken/ui/button";

// ---------------------------------------------------------------------------
// GraphErrorState
// ---------------------------------------------------------------------------

export function GraphErrorState(): React.ReactElement {
  return (
    <div
      role="alert"
      className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <AlertCircle className="size-8 text-destructive" aria-hidden />
      <div className="space-y-1">
        <p className="text-base font-semibold">Could not load the knowledge graph.</p>
        <p className="text-sm text-muted-foreground">Try refreshing the page.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
      >
        Refresh page
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphNoSchemaState
// ---------------------------------------------------------------------------

export function GraphNoSchemaState(): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Shapes className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-base font-semibold">No schema defined yet.</p>
        <p className="text-sm text-muted-foreground">
          Add entity types to see your knowledge network.
        </p>
      </div>
      {/* No button — entity type creation is out of scope per D-09 */}
    </div>
  );
}
