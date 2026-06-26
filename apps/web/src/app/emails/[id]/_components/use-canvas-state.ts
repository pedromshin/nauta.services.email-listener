"use client";

import { useCallback, useState } from "react";

import { useRegionEdit } from "./use-region-edit";

import type { CanvasMode } from "./canvas-toolbar";
import type { RegionEditState } from "./use-region-edit";

/**
 * The canvas interaction state machine (D-06/D-08/D-10).
 *
 * Owns tool mode, multi-selection, and the active-parent model; presentational
 * components read this and call back into it. The finished-draw + geometry-edit
 * routing lives in email-detail's handleRectDrawn (it owns the entity → field
 * context and the createRegion/redraw calls), not here.
 */
export interface CanvasState {
  // ---- Tool mode (D-08) ----
  readonly mode: CanvasMode;
  setMode: (mode: CanvasMode) => void;

  // ---- Selection (D-08) ----
  readonly selectedIds: readonly string[];
  /** Single-select (click). */
  select: (id: string) => void;
  /** Shift-click multi-select toggle. */
  shiftToggle: (id: string) => void;
  clearSelection: () => void;

  // ---- Active-parent model (D-10) ----
  readonly activeParentId: string | null;
  /** Arm an ENTITY as the active parent (next-drawn boxes become its fields). */
  setActiveParentId: (id: string | null) => void;
  /** Clear the active parent (Esc / click-empty / explicit Clear). */
  clearActiveParent: () => void;

  // ---- Shared region-edit primitives (Phase 6) ----
  /** The underlying region-edit state machine (redraw, createRegion, etc.). */
  readonly edit: RegionEditState;
  /** Component ids with an in-flight region-edit mutation (aria-busy). */
  readonly mutatingIds: readonly string[];
}

interface UseCanvasStateParams {
  readonly emailId: string;
}

/**
 * useCanvasState — the single owner of canvas tool/selection/active-parent state.
 * Returns an immutable `as const` object; state is never mutated in place
 * (CLAUDE.md immutability). The draw/geometry-edit create/redraw calls are owned
 * by the consumer (email-detail) via the shared `edit` (use-region-edit) machine.
 */
export function useCanvasState({
  emailId,
}: UseCanvasStateParams): CanvasState {
  const edit = useRegionEdit({ emailId });

  const [mode, setMode] = useState<CanvasMode>("select");
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [activeParentId, setActiveParentIdState] = useState<string | null>(null);

  const select = useCallback((id: string) => {
    setSelectedIds([id]);
  }, []);

  const shiftToggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const setActiveParentId = useCallback((id: string | null) => {
    setActiveParentIdState(id);
  }, []);

  const clearActiveParent = useCallback(() => {
    setActiveParentIdState(null);
  }, []);

  return {
    mode,
    setMode,

    selectedIds,
    select,
    shiftToggle,
    clearSelection,

    activeParentId,
    setActiveParentId,
    clearActiveParent,

    edit,
    mutatingIds: edit.mutatingIds,
  } as const;
}
