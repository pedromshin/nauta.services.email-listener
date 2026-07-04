"use client";

/**
 * canvas-empty-state.tsx — CanvasEmptyState: informational-only state shown
 * inside the canvas pane before any node exists (23-UI-SPEC.md Layout &
 * Structure "Empty-canvas state"). NOT a React Flow node — a plain
 * absolutely-centered div, same technique as /knowledge's
 * GraphNoSchemaState. No button: the remedy (send a message) lives on the
 * chat node's own composer / the docked Chat view, not here — this is a
 * transient/defensive state (the chat node is always present once a
 * conversation exists, D-02), not the primary first-run experience.
 */

import { LayoutGrid } from "lucide-react";

export function CanvasEmptyState(): React.ReactElement {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <LayoutGrid className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-base font-semibold">No panels yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Genui responses from this chat will appear here as panels. Switch to
          Chat view to start a conversation.
        </p>
      </div>
      {/* No button — the remedy lives on a different surface/view. */}
    </div>
  );
}
