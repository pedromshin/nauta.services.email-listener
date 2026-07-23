"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@polytoken/ui/card";
import { Skeleton } from "@polytoken/ui/skeleton";
import { Switch } from "@polytoken/ui/switch";

import { ActionToolbar } from "./action-toolbar";
import { DrawModeBar } from "./draw-mode-bar";
import { DrawOverlay } from "./draw-overlay";
import { OverlayLayer } from "~/components/regions/overlay-layer";

import type { CanvasMode } from "./canvas-toolbar";
import type { ComponentRole } from "~/components/regions/region-overlay-box";
import type { DrawMode, LiveRect, Polygon } from "./use-region-edit";

// pdfjs worker — initialized in useEffect to avoid SSR issues with
// import.meta.url resolving to a file:// path on the server (IN-03).
// Module-level assignment is deferred until the browser environment is ready.

interface Component {
  id: string;
  attachmentId: string | null;
  sourceType: string;
  contentText: string | null;
  extractionStatus: string;
  location: unknown;
  entityTypeLabel: string | null;
  entityTypeSlug: string | null;
  extractedFields: unknown;
  confidenceScore: unknown;
  parentComponentId: string | null;
  /**
   * Phase 9 (HIGH-1): relationship role drives the on-PDF role colors, the D-10
   * active-parent ring, and D-12 anti-bloat hiding in OverlayLayer. The data
   * already carries it from emails.detail (09-04); the pane just forwards it.
   */
  role?: ComponentRole;
}

interface EligibleRegion {
  readonly id: string;
  readonly extractionStatus: string;
  readonly entityTypeLabel: string | null;
}

interface PdfPreviewPaneProps {
  signedUrl: string;
  filename: string;
  components: Component[];
  activeComponentId: string | null;
  setActiveComponentId: (id: string | null) => void;
  /**
   * Controlled current page driven by the parent (WR-04).
   * When the parent calls `handleSelectComponent`, it updates its own
   * `currentPage` state and passes it down here so that entity clicks
   * navigate the PDF viewer to the correct page.
   */
  currentPage: number;
  /**
   * Callback invoked whenever the user navigates pages inside the pane.
   * Keeps parent state in sync so `handleSelectComponent` has accurate context.
   */
  onPageChange: (page: number) => void;
  onClose: () => void;

  // ---- Phase 6: region edit state + handlers (owned by useRegionEdit) ----
  selectedComponentIds: readonly string[];
  drawMode: DrawMode;
  liveRect: LiveRect | null;
  setLiveRect: (rect: LiveRect | null) => void;
  drawnRects: ReadonlyArray<Polygon>;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  /**
   * Controlled overlay visibility (Bundle C single source of truth). The shell
   * toolbar's "Regions" toggle owns this state and drives the on-PDF overlays;
   * the pane no longer keeps a divergent pane-local copy nor its own toggle.
   */
  showOverlays: boolean;
  mutatingComponentIds: readonly string[];
  onSelectComponent: (id: string) => void;
  onShiftClick: (id: string) => void;
  onClearSelection: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onRedraw: () => void;
  onSplit: () => void;
  onEnterDraw: (mode: "redraw" | "split" | "add") => void;
  onCancelDraw: () => void;
  onRectDrawn: (polygon: Polygon) => void;
  onConfirmSplit: () => void;
  /** Whether an attachment_page component exists for the current page. */
  canAddRegion: boolean;
  /** Classify the whole current page as one entity (creates a full-page region). */
  onClassifyPage?: () => void;
  /** Classify the whole multi-page attachment as one entity (spans all pages). */
  onClassifyDocument?: () => void;

  // ---- Phase 6 (06-04): dialog/picker controlled state ----
  /** Controlled open state for the reject confirmation dialog. */
  rejectDialogOpen: boolean;
  onRejectDialogChange: (open: boolean) => void;
  /** Controlled open state for the nest picker popover. */
  nestPickerOpen: boolean;
  onNestPickerChange: (open: boolean) => void;
  /** Eligible regions for nesting (same page, not selected, not rejected/superseded). */
  eligibleRegions: readonly EligibleRegion[];
  onMerge?: (ids: readonly string[]) => void;
  onNest?: (componentId: string, parentId: string) => void;
  onUnNest?: (componentId: string) => void;

  // ---- Phase 7: autofill props (passed through to ActionToolbar) ----
  onAutofill?: (componentId: string, entityTypeSlug: string) => void;
  autofillPickerOpen?: boolean;
  onAutofillPickerChange?: (open: boolean) => void;
  autofillExtracting?: boolean;

  // ---- Phase 9 (HIGH-2): shell tool-mode arms drawing ----
  /**
   * The Phase-9 shell tool mode (Select/Draw, D-08). When "draw" — and no legacy
   * redraw/split/add flow is active — the pane arms a free-draw on the page so
   * the toolbar's Draw toggle actually draws (drag-to-draw). Defaults to "select".
   */
  canvasMode?: CanvasMode;

  // ---- Phase 9 (HIGH-1/WR-01): canvas relationship model on the PDF ----
  /**
   * D-10/D-12: the armed active-parent ENTITY id. Threaded into OverlayLayer so
   * the active entity draws its ring and its FIELD children reveal (anti-bloat).
   */
  activeParentId?: string | null;
  /** D-05/D-12: reveal UNRELATED boxes on the document (toolbar toggle). */
  showUnrelated?: boolean;
  /** D-16: FIELD component ids that should show the inline ✓/✗ on the PDF. */
  confirmDenyComponentIds?: readonly string[];
  /** D-18/WR-05: component ids auto-detected by autofill (origin-aware deny). */
  autoDetectedComponentIds?: readonly string[];
  /** D-16/D-17: confirm a candidate FIELD from the on-PDF inline ✓. */
  onConfirmField?: (id: string) => void;
  /** D-16/D-18: deny a candidate FIELD from the on-PDF inline ✗ (origin-aware). */
  onDenyField?: (id: string) => void;
}

const MAX_FILENAME_LEN = 32;

// Phase 9 (D-07): canvas zoom bounds expanded to 0.25–4.0 (was 0.5–3.0).
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 0.25;

function truncateFilename(name: string): string {
  if (name.length <= MAX_FILENAME_LEN) return name;
  return `${name.slice(0, MAX_FILENAME_LEN)}…`;
}

export function PdfPreviewPane({
  signedUrl,
  filename,
  components,
  activeComponentId,
  setActiveComponentId,
  currentPage,
  onPageChange,
  onClose,
  selectedComponentIds,
  drawMode,
  liveRect,
  setLiveRect,
  drawnRects,
  showHistory,
  setShowHistory,
  showOverlays,
  mutatingComponentIds,
  onSelectComponent,
  onShiftClick,
  onClearSelection,
  onAccept,
  onReject,
  onRedraw,
  onSplit,
  onEnterDraw,
  onCancelDraw,
  onRectDrawn,
  onConfirmSplit,
  canAddRegion,
  onClassifyPage,
  onClassifyDocument,
  rejectDialogOpen,
  onRejectDialogChange,
  nestPickerOpen,
  onNestPickerChange,
  eligibleRegions,
  onMerge,
  onNest,
  onUnNest,
  onAutofill,
  autofillPickerOpen,
  onAutofillPickerChange,
  autofillExtracting,
  canvasMode = "select",
  activeParentId = null,
  showUnrelated = false,
  confirmDenyComponentIds = [],
  autoDetectedComponentIds = [],
  onConfirmField,
  onDenyField,
}: PdfPreviewPaneProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Phase 9 (D-07): the scroll viewport drives zoom-to-cursor + Space-pan.
  const scrollRef = useRef<HTMLDivElement>(null);
  // Space-held pan state — kept in refs to avoid re-render churn while dragging.
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const spaceHeldRef = useRef<boolean>(false);
  const panStartRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  // Initialize pdfjs worker inside useEffect so import.meta.url resolves
  // to a browser URL rather than a file:// SSR path (IN-03).
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }, []);

  function handleLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setLoadError(false);
  }

  function handleLoadError() {
    setLoadError(true);
  }

  function handleRenderSuccess({ width, height }: { width: number; height: number }) {
    setPageSize({ width, height });
  }

  function handlePrevPage() {
    if (currentPage > 1) onPageChange(currentPage - 1);
  }

  function handleNextPage() {
    if (numPages !== null && currentPage < numPages) onPageChange(currentPage + 1);
  }

  // Phase 9 (D-07): zoom range expanded to 0.25–4.0 (was 0.5–3.0), step 0.25.
  function clampScale(s: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(s * 100) / 100));
  }

  function handleZoomOut() {
    setScale((s) => clampScale(s - ZOOM_STEP));
  }

  function handleZoomIn() {
    setScale((s) => clampScale(s + ZOOM_STEP));
  }

  function handleZoomReset() {
    setScale(1.0);
  }

  // Fit-width / Fit-page (D-07): derive the target scale from the panel width /
  // page size. pageSize is the rendered size AT the current scale, so the
  // unscaled page width is pageSize.width / scale.
  function handleFitWidth() {
    const viewport = scrollRef.current;
    if (!viewport || pageSize === null) return;
    const unscaledWidth = pageSize.width / scale;
    if (unscaledWidth <= 0) return;
    // Subtract the p-4 padding (16px each side) so the page fits inside.
    const target = (viewport.clientWidth - 32) / unscaledWidth;
    setScale(clampScale(target));
  }

  function handleFitPage() {
    const viewport = scrollRef.current;
    if (!viewport || pageSize === null) return;
    const unscaledWidth = pageSize.width / scale;
    const unscaledHeight = pageSize.height / scale;
    if (unscaledWidth <= 0 || unscaledHeight <= 0) return;
    const widthScale = (viewport.clientWidth - 32) / unscaledWidth;
    const heightScale = (viewport.clientHeight - 32) / unscaledHeight;
    setScale(clampScale(Math.min(widthScale, heightScale)));
  }

  // Cmd/Ctrl + scroll = zoom-to-cursor (D-07). Compute the cursor's content
  // position before zoom, apply the new scale, then re-scroll so the same
  // content point stays under the cursor.
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const viewport = scrollRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = e.clientX - rect.left + viewport.scrollLeft;
    const pointerY = e.clientY - rect.top + viewport.scrollTop;
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setScale((prev) => {
      const next = clampScale(prev + delta);
      if (next === prev) return prev;
      const factor = next / prev;
      // Re-anchor on the next frame so the content has re-laid-out at new scale.
      requestAnimationFrame(() => {
        viewport.scrollLeft = pointerX * factor - (e.clientX - rect.left);
        viewport.scrollTop = pointerY * factor - (e.clientY - rect.top);
      });
      return next;
    });
  }

  // Space + drag = pan (D-07). Space toggles the grab cursor; pointer-down while
  // Space is held captures the drag and scrolls the viewport.
  function handlePanPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const viewport = scrollRef.current;
    if (!viewport || !spaceHeldRef.current) return;
    e.preventDefault();
    setIsPanning(true);
    viewport.setPointerCapture(e.pointerId);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
  }

  function handlePanPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const viewport = scrollRef.current;
    const start = panStartRef.current;
    if (!viewport || !start) return;
    viewport.scrollLeft = start.left - (e.clientX - start.x);
    viewport.scrollTop = start.top - (e.clientY - start.y);
  }

  function handlePanPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const viewport = scrollRef.current;
    if (viewport && viewport.hasPointerCapture(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
    panStartRef.current = null;
    setIsPanning(false);
  }

  // Keyboard shortcuts (06-UI-SPEC §3.2): Escape cancels draw / deselects,
  // Delete opens the reject dialog (not direct reject — 06-04 stub fix),
  // A accepts a single pending region.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Phase 9 (D-07): zoom keybindings (Cmd/Ctrl +/-/0, Cmd/Ctrl+Shift+W/F).
    if (e.ctrlKey || e.metaKey) {
      if (e.shiftKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        handleFitWidth();
        return;
      }
      if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        handleFitPage();
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        handleZoomReset();
        return;
      }
    }
    // Phase 9 (D-07): Space arms pan mode (grab cursor). Ignore when typing.
    if (e.key === " " || e.code === "Space") {
      spaceHeldRef.current = true;
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      if (drawMode !== null) {
        onCancelDraw();
      } else if (selectedComponentIds.length > 0) {
        onClearSelection();
      }
      return;
    }
    if (drawMode !== null || selectedComponentIds.length !== 1) return;
    const selected = components.find((c) => c.id === selectedComponentIds[0]);
    if (!selected) return;
    if (e.key === "Delete") {
      if (
        selected.extractionStatus === "pending" ||
        selected.extractionStatus === "candidate"
      ) {
        // Open dialog instead of firing reject directly (06-04 stub fix).
        onRejectDialogChange(true);
      }
    } else if (e.key === "a" || e.key === "A") {
      if (selected.extractionStatus === "pending") {
        onAccept(selected.id);
      }
    }
  }

  function handleTooSmall() {
    toast.warning("That rectangle's too small — try drawing a larger area.");
  }

  // HIGH-2: a legacy redraw/split/add flow (drawMode) always wins; otherwise the
  // Phase-9 shell "draw" tool arms a free-draw so the toolbar toggle actually
  // draws. drawArmed gates the DrawOverlay mount + the overlay-dimming; the
  // DrawModeBar stays exclusive to the legacy flow (its UX is redraw/split).
  const legacyDrawActive = drawMode !== null;
  const drawArmed = legacyDrawActive || canvasMode === "draw";

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF Preview</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-2">
          {/* "Preview failed" is a STATUS, and a reversible one — the button
              directly below it opens the very file that failed to preview.
              Law 1 spends madder on the irreversible only, so this reads in
              ink weight on the same marker shape the detail header uses.

              Worth naming: `role-hue-ban.test.ts` did NOT catch this one. Its
              rule allows the madder VARIANT (an irreversible button is
              legitimate) and bans only madder TEXT and BORDERS — a proxy for
              "a state is talking", and this was a state talking through the
              allowed door. A source gate cannot read intent; a human read
              this line. */}
          <Badge
            variant="outline"
            className="border-rule bg-bright text-2xs font-semibold text-ink"
          >
            Preview failed
          </Badge>
          <p className="text-muted-foreground text-sm">
            Could not load PDF preview. Try downloading the file directly.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(signedUrl, "_blank")}
          >
            Download file
          </Button>
        </CardContent>
      </Card>
    );
  }

  const displayName = truncateFilename(filename);
  const pageLabel = numPages !== null
    ? `Page ${currentPage} / ${numPages}`
    : "Loading…";

  return (
    <div
      className="w-full rounded-xl border bg-card text-card-foreground shadow-sm"
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => {
        // Phase 9 (D-07): release Space-held pan mode.
        if (e.key === " " || e.code === "Space") {
          spaceHeldRef.current = false;
          setIsPanning(false);
          panStartRef.current = null;
        }
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        {/* Filename */}
        <span
          className="text-sm font-medium text-muted-foreground truncate max-w-[200px] shrink-0"
          title={filename}
        >
          {displayName}
        </span>

        {/* Page navigation */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          ← Prev
        </Button>

        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {pageLabel}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          disabled={numPages === null || currentPage >= numPages}
          aria-label="Next page"
        >
          Next →
        </Button>

        {/* Zoom — range 0.25–4.0 (D-07) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          disabled={scale <= ZOOM_MIN}
          aria-label="Zoom out"
        >
          −
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomReset}
          aria-label="Current zoom, click to reset to 100%"
          title="Reset zoom to 100%"
        >
          {Math.round(scale * 100)}%
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          disabled={scale >= ZOOM_MAX}
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitWidth}
          aria-label="Fit page to panel width"
        >
          Fit width
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitPage}
          aria-label="Fit full page in view"
        >
          Fit page
        </Button>

        {/* History toggle — reveals rejected/superseded regions.
            "Show regions" lives in the shell toolbar (single source of truth,
            Bundle C); the controlled `showOverlays` prop drives the layer below. */}
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Switch
            checked={showHistory}
            onCheckedChange={setShowHistory}
            aria-label="Show history — rejected and superseded regions"
          />
          <span>Show history</span>
        </label>

        {/* Add region — works with zero proposed regions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEnterDraw("add")}
          disabled={!canAddRegion || drawMode !== null}
        >
          + Add region
        </Button>

        {/* Classify whole page as one entity — full-page region, no drawing needed */}
        {onClassifyPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClassifyPage}
            disabled={!canAddRegion || drawMode !== null}
            title="Create a region covering the whole page, then autofill it as one entity"
          >
            Classify Page
          </Button>
        )}

        {/* Classify the whole multi-page document as ONE entity (spans all pages) */}
        {onClassifyDocument && numPages !== null && numPages > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClassifyDocument}
            disabled={!canAddRegion || drawMode !== null}
            title="Treat the entire multi-page attachment as one entity (e.g. a 4-page contract), then autofill it"
          >
            Classify Document
          </Button>
        )}

        {/* Close */}
        <Button
          ref={closeButtonRef}
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close preview"
          className="ml-auto"
        >
          ✕
        </Button>
      </div>

      {/* Draw mode banner — shown while drawMode is active */}
      {drawMode !== null && (
        <DrawModeBar
          mode={drawMode}
          drawnCount={drawnRects.length}
          onCancel={onCancelDraw}
          onConfirmSplit={onConfirmSplit}
          onDrawAnother={() => setLiveRect(null)}
        />
      )}

      {/* Action toolbar — CSS-hidden (not unmounted) when nothing selected */}
      <div
        style={{
          display: selectedComponentIds.length > 0 ? undefined : "none",
        }}
      >
        <ActionToolbar
          selectedComponentIds={selectedComponentIds}
          components={components}
          onAccept={onAccept}
          onRejectConfirm={onReject}
          onRedraw={onRedraw}
          onSplit={onSplit}
          onMerge={onMerge}
          onNest={onNest}
          onUnNest={onUnNest}
          rejectDialogOpen={rejectDialogOpen}
          onRejectDialogChange={onRejectDialogChange}
          nestPickerOpen={nestPickerOpen}
          onNestPickerChange={onNestPickerChange}
          eligibleRegions={eligibleRegions}
          disabled={drawMode !== null}
          onAutofill={onAutofill}
          autofillPickerOpen={autofillPickerOpen}
          onAutofillPickerChange={onAutofillPickerChange}
          autofillExtracting={autofillExtracting}
        />
      </div>

      {/* PDF body — the scroll viewport drives zoom-to-cursor + Space-pan (D-07).
          tabIndex makes it focusable so the canvas-scoped keybindings fire. */}
      <div
        ref={scrollRef}
        className={`overflow-auto p-4 ${
          isPanning ? "cursor-grabbing" : spaceHeldRef.current ? "cursor-grab" : ""
        }`}
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePanPointerDown}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerUp}
      >
        <div
          className="relative w-fit mx-auto"
          aria-label={`PDF preview — ${filename}, page ${currentPage} of ${numPages ?? "?"}`}
        >
          <Document
            file={signedUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={
              <Skeleton className="h-96 w-full rounded-xl" />
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              onRenderSuccess={handleRenderSuccess}
              loading={<Skeleton className="h-96 w-full rounded-xl" />}
            />
          </Document>

          {/* Overlay layer — hidden via CSS (not unmounted) to preserve sync state per §7.3.
              During draw mode the boxes dim to opacity-40 and become inert. */}
          <div
            style={{ display: showOverlays ? undefined : "none" }}
            className={drawArmed ? "opacity-40 pointer-events-none" : undefined}
            aria-hidden={drawArmed}
          >
            <OverlayLayer
              components={components}
              currentPage={currentPage}
              pageSize={pageSize}
              activeComponentId={activeComponentId}
              setActiveComponentId={setActiveComponentId}
              showHistory={showHistory}
              selectedComponentIds={selectedComponentIds}
              onSelectComponent={onSelectComponent}
              onShiftClick={onShiftClick}
              mutatingComponentIds={mutatingComponentIds}
              activeParentId={activeParentId}
              showUnrelated={showUnrelated}
              confirmDenyComponentIds={confirmDenyComponentIds}
              autoDetectedComponentIds={autoDetectedComponentIds}
              onConfirmField={onConfirmField}
              onDenyField={onDenyField}
            />
          </div>

          {/* Draw surface — mounted while a legacy flow OR the shell Draw tool is
              armed (HIGH-2). On rect drawn, onRectDrawn routes in email-detail:
              active-parent → FIELD child (D-10), else standalone region. */}
          {drawArmed && pageSize !== null && (
            <DrawOverlay
              pageSize={pageSize}
              liveRect={liveRect}
              setLiveRect={setLiveRect}
              onRectDrawn={onRectDrawn}
              onTooSmall={handleTooSmall}
            />
          )}
        </div>
      </div>
    </div>
  );
}
