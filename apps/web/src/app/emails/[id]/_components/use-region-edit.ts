"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/** Normalized 4-corner polygon as returned by normalizedRectToPolygon. */
export type Polygon = ReadonlyArray<readonly [number, number]>;

/** The draw mode variants: replace existing region, split into sub-regions, or add a new region. */
export type DrawMode = "redraw" | "split" | "add" | null;

/** Live rect during a pointer drag. */
export interface LiveRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** All state and handlers owned by the region-edit feature. */
export interface RegionEditState {
  // Selection state
  readonly selectedComponentIds: readonly string[];
  readonly drawMode: DrawMode;
  readonly drawnRects: ReadonlyArray<Polygon>;
  readonly liveRect: LiveRect | null;
  readonly showHistory: boolean;
  readonly rejectDialogOpen: boolean;
  readonly nestPickerOpen: boolean;
  /** Component ids with an in-flight mutation (drives aria-busy + pulse). */
  readonly mutatingIds: readonly string[];

  // Selection helpers
  selectComponent: (id: string) => void;
  shiftToggle: (id: string) => void;
  clearSelection: () => void;

  // Draw helpers
  enterDraw: (mode: "redraw" | "split" | "add") => void;
  cancelDraw: () => void;
  pushRect: (polygon: Polygon) => void;
  setLiveRect: (rect: LiveRect | null) => void;

  // UI toggles
  setShowHistory: (show: boolean) => void;
  setRejectDialogOpen: (open: boolean) => void;
  setNestPickerOpen: (open: boolean) => void;

  // Mutation handlers
  accept: (id: string) => void;
  reject: (id: string) => void;
  redraw: (id: string, polygon: Polygon, pageIndex: number) => void;
  split: (id: string, regions: ReadonlyArray<{ polygon: Polygon; pageIndex: number }>) => void;
  createRegion: (pageComponentId: string, polygon: Polygon, pageIndex: number) => void;
  classifyDocument: (pageComponentId: string) => void;
  merge: (componentIds: readonly string[], polygon?: Polygon, pageIndex?: number) => void;
  nest: (componentId: string, parentComponentId: string | null) => void;
}

interface UseRegionEditParams {
  readonly emailId: string;
}

export function useRegionEdit({ emailId }: UseRegionEditParams): RegionEditState {
  const utils = api.useUtils();

  // Selection state
  const [selectedComponentIds, setSelectedComponentIds] = useState<readonly string[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [drawnRects, setDrawnRects] = useState<ReadonlyArray<Polygon>>([]);
  const [liveRect, setLiveRectState] = useState<LiveRect | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [nestPickerOpen, setNestPickerOpen] = useState<boolean>(false);

  // Accept mutation — optimistic: pending → candidate
  const acceptMutation = api.emails.accept.useMutation({
    onMutate: ({ componentId }: { componentId: string }) => {
      // Snapshot current state for potential revert
      const prevData = utils.emails.detail.getData({ id: emailId });
      // Optimistic update: flip status to candidate
      utils.emails.detail.setData({ id: emailId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map((c) =>
            c.id === componentId ? { ...c, extractionStatus: "candidate" } : c,
          ),
        };
      });
      return { prevData };
    },
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Region accepted");
      setSelectedComponentIds([]);
    },
    onError: (_err, _vars, context) => {
      // Revert optimistic update
      if (context?.prevData !== undefined) {
        utils.emails.detail.setData({ id: emailId }, context.prevData);
      }
      toast.error("Could not accept region. Try again.");
    },
  });

  // Reject mutation — optimistic: → rejected
  const rejectMutation = api.emails.reject.useMutation({
    onMutate: ({ componentId }: { componentId: string }) => {
      const prevData = utils.emails.detail.getData({ id: emailId });
      utils.emails.detail.setData({ id: emailId }, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          components: prev.components.map((c) =>
            c.id === componentId ? { ...c, extractionStatus: "rejected" } : c,
          ),
        };
      });
      return { prevData };
    },
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Region rejected");
      setSelectedComponentIds([]);
      setRejectDialogOpen(false);
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.emails.detail.setData({ id: emailId }, context.prevData);
      }
      toast.error("Could not reject region. Try again.");
    },
  });

  // Redraw mutation
  const redrawMutation = api.emails.redraw.useMutation({
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Region redrawn");
      setSelectedComponentIds([]);
      setDrawMode(null);
      setDrawnRects([]);
    },
    onError: () => {
      toast.error("Could not redraw region. Try again.");
    },
  });

  // Split mutation
  const splitMutation = api.emails.split.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.emails.detail.invalidate({ id: emailId });
      const n = variables.regions.length;
      toast.success(`Region split into ${n} parts`);
      setSelectedComponentIds([]);
      setDrawMode(null);
      setDrawnRects([]);
    },
    onError: () => {
      toast.error("Could not split region. Try again.");
    },
  });

  // Create region mutation
  const createRegionMutation = api.emails.createRegion.useMutation({
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Region added");
      setDrawMode(null);
      setDrawnRects([]);
    },
    onError: () => {
      toast.error("Could not add region. Try again.");
    },
  });

  // Classify-document mutation — whole multi-page attachment as one candidate region
  const classifyDocumentMutation = api.emails.classifyDocument.useMutation({
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Document classified — autofill it as one entity");
    },
    onError: () => {
      toast.error("Could not classify document. Try again.");
    },
  });

  // Merge mutation — combines ≥2 selected regions into one new candidate
  const mergeMutation = api.emails.merge.useMutation({
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Regions merged");
      setSelectedComponentIds([]);
    },
    onError: () => {
      toast.error("Could not merge regions. Try again.");
    },
  });

  // Nest mutation — sets or clears the parent_component_id of a region
  const nestMutation = api.emails.nest.useMutation({
    onSuccess: async () => {
      await utils.emails.detail.invalidate({ id: emailId });
      toast.success("Region nested");
      setNestPickerOpen(false);
    },
    onError: () => {
      toast.error("Could not nest region. Try again.");
    },
  });

  // Component ids with an in-flight mutation — drives aria-busy + pulse styling.
  // Includes merge, nest, and createRegion so all pending operations get
  // the animate-pulse / aria-busy visual feedback (WR-01).
  const mutatingIds: readonly string[] = [
    ...(acceptMutation.isPending && acceptMutation.variables
      ? [acceptMutation.variables.componentId]
      : []),
    ...(rejectMutation.isPending && rejectMutation.variables
      ? [rejectMutation.variables.componentId]
      : []),
    ...(redrawMutation.isPending && redrawMutation.variables
      ? [redrawMutation.variables.componentId]
      : []),
    ...(splitMutation.isPending && splitMutation.variables
      ? [splitMutation.variables.componentId]
      : []),
    ...(mergeMutation.isPending && mergeMutation.variables
      ? mergeMutation.variables.componentIds
      : []),
    ...(nestMutation.isPending && nestMutation.variables
      ? [nestMutation.variables.componentId]
      : []),
    ...(createRegionMutation.isPending && createRegionMutation.variables
      ? [createRegionMutation.variables.pageComponentId]
      : []),
  ];

  // ---- Selection helpers ----

  function selectComponent(id: string): void {
    setSelectedComponentIds([id]);
  }

  function shiftToggle(id: string): void {
    setSelectedComponentIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function clearSelection(): void {
    setSelectedComponentIds([]);
  }

  // ---- Draw helpers ----

  function enterDraw(mode: "redraw" | "split" | "add"): void {
    setDrawMode(mode);
    setDrawnRects([]);
    setLiveRectState(null);
  }

  function cancelDraw(): void {
    setDrawMode(null);
    setDrawnRects([]);
    setLiveRectState(null);
  }

  function pushRect(polygon: Polygon): void {
    setDrawnRects((prev) => [...prev, polygon]);
  }

  function setLiveRect(rect: LiveRect | null): void {
    setLiveRectState(rect);
  }

  // ---- Mutation handler functions ----

  function accept(id: string): void {
    acceptMutation.mutate({ componentId: id });
  }

  function reject(id: string): void {
    rejectMutation.mutate({ componentId: id });
  }

  function redraw(id: string, polygon: Polygon, pageIndex: number): void {
    redrawMutation.mutate({
      componentId: id,
      polygon: polygon as [number, number][],
      pageIndex,
    });
  }

  function split(
    id: string,
    regions: ReadonlyArray<{ polygon: Polygon; pageIndex: number }>,
  ): void {
    splitMutation.mutate({
      componentId: id,
      regions: regions.map((r) => ({
        polygon: r.polygon as [number, number][],
        pageIndex: r.pageIndex,
      })),
    });
  }

  function createRegion(
    pageComponentId: string,
    polygon: Polygon,
    pageIndex: number,
  ): void {
    createRegionMutation.mutate({
      pageComponentId,
      polygon: polygon as [number, number][],
      pageIndex,
    });
  }

  function classifyDocument(pageComponentId: string): void {
    classifyDocumentMutation.mutate({ pageComponentId });
  }

  function merge(
    componentIds: readonly string[],
    polygon?: Polygon,
    pageIndex?: number,
  ): void {
    mergeMutation.mutate({
      componentIds: [...componentIds],
      ...(polygon !== undefined && { polygon: polygon as [number, number][] }),
      ...(pageIndex !== undefined && { pageIndex }),
    });
  }

  function nest(componentId: string, parentComponentId: string | null): void {
    nestMutation.mutate({ componentId, parentComponentId });
  }

  return {
    selectedComponentIds,
    drawMode,
    drawnRects,
    liveRect,
    showHistory,
    rejectDialogOpen,
    nestPickerOpen,
    mutatingIds,

    selectComponent,
    shiftToggle,
    clearSelection,

    enterDraw,
    cancelDraw,
    pushRect,
    setLiveRect,

    setShowHistory,
    setRejectDialogOpen,
    setNestPickerOpen,

    accept,
    reject,
    redraw,
    split,
    createRegion,
    classifyDocument,
    merge,
    nest,
  };
}
