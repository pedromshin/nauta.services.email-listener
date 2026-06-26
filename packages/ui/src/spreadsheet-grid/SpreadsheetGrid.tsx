"use client";

import type {
  CellClassParams,
  CellClickedEvent,
  CellMouseDownEvent,
  CellValueChangedEvent,
  ColDef,
  Column,
  ColumnHeaderClickedEvent,
  ColumnHeaderContextMenuEvent,
  ColumnMovedEvent,
  ColumnResizedEvent,
  GridApi,
  GridReadyEvent,
  RowDragEndEvent,
} from "ag-grid-community";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Plus,
  X,
} from "lucide-react";

import { Button } from "../button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { Input } from "../input";
import { Skeleton } from "../skeleton";

import "./theme.css";

import type {
  CellChangeEvent,
  FormatRule,
  FormattingRules,
  SaveStatus,
  SchemaFieldType,
  SpreadsheetGridProps,
  SpreadsheetRow,
} from "./types";
import { AddColumnDialog } from "./add-column-dialog";
import { buildColumnDefs } from "./column-defs";
import { ColumnHeaderMenu } from "./column-header-menu";
import { ConditionalFormattingDialog } from "./conditional-formatting-dialog";
import { useConditionalFormatting } from "./hooks/use-conditional-formatting";
import { useGridClipboard } from "./hooks/use-grid-clipboard";
import { useGridFind } from "./hooks/use-grid-find";
import { useRangeSelection } from "./hooks/use-range-selection";
import { RowContextMenu } from "./row-context-menu";

// Register AG Grid Community modules once at module scope
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Platform theme — extends themeQuartz with design token CSS variables.
 * The `.ag-theme-platform` class in theme.css adds further overrides
 * (frozen-column shadow, conditional-formatting cell classes, etc.).
 */
const platformTheme = themeQuartz.withParams({
  backgroundColor: "hsl(var(--background))",
  foregroundColor: "hsl(var(--foreground))",
  headerBackgroundColor: "hsl(var(--card))",
  headerTextColor: "hsl(var(--card-foreground))",
  borderColor: "hsl(var(--border))",
  rowHoverColor: "hsl(var(--accent))",
  selectedRowBackgroundColor: "hsl(var(--primary) / 0.08)",
  rangeSelectionBackgroundColor: "hsl(var(--primary) / 0.1)",
  rangeSelectionBorderColor: "hsl(var(--primary))",
  fontSize: 14,
  fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)",
  rowHeight: 36,
  headerHeight: 40,
  inputFocusBorder: "solid 2px hsl(var(--ring))",
});

/** Drag handle column — pinned left, before row number */
const DRAG_HANDLE_COLUMN: ColDef<SpreadsheetRow> = {
  colId: "__drag_handle__",
  rowDrag: true,
  width: 30,
  maxWidth: 30,
  minWidth: 30,
  suppressMovable: true,
  editable: false,
  sortable: false,
  filter: false,
  pinned: "left",
  headerName: "",
  resizable: false,
  suppressHeaderMenuButton: true,
};

/** Extract field name from colDef */
function extractFieldName(colDef: ColDef): string {
  return colDef.colId ?? colDef.field ?? "";
}

/** Loading skeleton — 8 rows x 4 columns */
function GridSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Header row */}
      <div className="flex gap-2 pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 flex-1 rounded-md" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-2">
          {Array.from({ length: 4 }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-9 flex-1 rounded-sm" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Empty state component */
function GridEmptyState({ onRowAdd }: { readonly onRowAdd?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16">
      <Database className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="text-lg font-medium">No records yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Add your first row to start building your dataset.
      </p>
      {onRowAdd && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={onRowAdd}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Row
        </Button>
      )}
    </div>
  );
}

/** Save status display text */
function getSaveStatusText(status: SaveStatus): string | null {
  switch (status) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    default:
      return null;
  }
}

/** Pending paste data for the confirmation dialog */
interface PendingPaste {
  readonly text: string;
  readonly startRowIndex: number;
  readonly startColId: string;
  readonly visibleColIds: readonly string[];
  readonly rowCount: number;
  readonly colCount: number;
}

/** State for the column header context menu */
interface ContextMenuColumn {
  readonly name: string;
  readonly type: SchemaFieldType;
  /** Trigger element ref for positioning the menu */
  readonly triggerKey: string;
}

export function SpreadsheetGrid({
  rows,
  columns,
  isEditable,
  dataSourceId,
  saveStatus,
  totalRecords,
  onCellChange,
  onRowAdd,
  onRowDelete,
  onRowDetailOpen,
  onLoadMore,
  hasMore,
  isLoading,
  onRowReorder,
  onColumnAdd,
  onColumnRename,
  onColumnChangeType,
  onColumnDelete,
  formattingRules,
  onFormattingRulesChange,
}: SpreadsheetGridProps) {
  const gridApiRef = useRef<GridApi<SpreadsheetRow> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Column management state ----
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [contextMenuColumn, setContextMenuColumn] =
    useState<ContextMenuColumn | null>(null);

  // ---- Row context menu state ----
  const [contextMenuRow, setContextMenuRow] = useState<{
    readonly rowId: string;
    readonly position: { readonly x: number; readonly y: number };
    readonly triggerKey: string;
  } | null>(null);

  // ---- Conditional formatting (D-15) ----
  const { buildCellClassRules: buildCfCellClassRules } =
    useConditionalFormatting(formattingRules ?? {});
  const [cfDialogColumn, setCfDialogColumn] = useState<string | null>(null);

  // ---- Range selection ----
  const {
    range,
    handleCellMouseDown,
    handleKeyDown: handleRangeKeyDown,
    isInRange,
    getSelectedCells,
  } = useRangeSelection();

  // ---- Find bar ----
  const find = useGridFind(gridApiRef.current);

  // ---- Paste preview dialog state ----
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null);

  const pasteResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  // ---- Clipboard ----
  // Paste confirmation is handled inline via the dialog; we manage it in the keydown handler
  const { handleCopy, handlePaste, handleDelete } = useGridClipboard(
    gridApiRef.current,
    range,
    getSelectedCells,
    undefined,
  );

  // ---- Find bar + range + conditional formatting cell class rules ----
  // Build cellClassRules merging range selection, find highlights, and conditional formatting
  const buildCellClassRules = useCallback(
    (columnName?: string): ColDef["cellClassRules"] => {
      // Base rules: range + find
      const baseRules: NonNullable<ColDef["cellClassRules"]> = {
        "range-selected": (params: CellClassParams<SpreadsheetRow>) => {
          const rowIndex = params.node?.rowIndex;
          const colId = params.colDef?.colId ?? params.colDef?.field;
          if (rowIndex === null || rowIndex === undefined || !colId)
            return false;
          return isInRange(rowIndex, colId);
        },
        "find-match": (params: CellClassParams<SpreadsheetRow>) => {
          const rowIndex = params.node?.rowIndex;
          const colId = params.colDef?.colId ?? params.colDef?.field;
          if (rowIndex === null || rowIndex === undefined || !colId)
            return false;
          return (
            find.isMatchCell(rowIndex, colId) &&
            !find.isCurrentMatchCell(rowIndex, colId)
          );
        },
        "find-match-current": (params: CellClassParams<SpreadsheetRow>) => {
          const rowIndex = params.node?.rowIndex;
          const colId = params.colDef?.colId ?? params.colDef?.field;
          if (rowIndex === null || rowIndex === undefined || !colId)
            return false;
          return find.isCurrentMatchCell(rowIndex, colId);
        },
      };

      // Merge conditional formatting rules for this column (if provided)
      if (columnName) {
        const cfRules = buildCfCellClassRules(columnName);
        return { ...baseRules, ...cfRules };
      }

      return baseRules;
    },
    [isInRange, find, buildCfCellClassRules],
  );

  // ---- "+" add column button (D-10) ----
  const addColumnDef = useMemo<ColDef<SpreadsheetRow>>(
    () => ({
      colId: "__add_column__",
      headerName: "+",
      width: 40,
      maxWidth: 40,
      minWidth: 40,
      editable: false,
      sortable: false,
      filter: false,
      suppressMovable: true,
      resizable: false,
      suppressHeaderMenuButton: true,
      headerClass: "add-column-header",
    }),
    [],
  );

  // Build column definitions, with drag handle prepended when editable and + appended
  // Each data column gets per-column cellClassRules merging range/find + conditional formatting
  const columnDefs = useMemo<ColDef<SpreadsheetRow>[]>(() => {
    const dataCols = buildColumnDefs(columns, isEditable).map((colDef) => {
      const colName = colDef.colId ?? colDef.field;
      if (!colName) return colDef;
      return {
        ...colDef,
        cellClassRules: buildCellClassRules(colName),
      };
    });
    if (isEditable) {
      return [DRAG_HANDLE_COLUMN, ...dataCols, addColumnDef];
    }
    return dataCols;
  }, [columns, isEditable, addColumnDef, buildCellClassRules]);

  /** Default column definition with base class rules (range/find only, no CF — applied per-column above) */
  const defaultColDef = useMemo<ColDef<SpreadsheetRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: true,
      editable: isEditable,
      minWidth: 80,
      ...(isEditable ? {} : { cellClass: "cell-readonly" }),
      cellClassRules: buildCellClassRules(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEditable, range, find.matches, find.currentMatchIndex, formattingRules],
  );

  /** Restore column widths from localStorage on grid ready */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<SpreadsheetRow>) => {
      gridApiRef.current = event.api;

      const storageKey = `data-platform:grid-cols:${dataSourceId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const columnState = JSON.parse(saved) as unknown;
          if (Array.isArray(columnState)) {
            event.api.applyColumnState({
              state: columnState,
              applyOrder: true,
            });
          }
        } catch {
          // Ignore invalid saved state
        }
      }
    },
    [dataSourceId],
  );

  /** Persist column widths to localStorage when resized */
  const handleColumnResized = useCallback(
    (event: ColumnResizedEvent<SpreadsheetRow>) => {
      if (!event.finished || !gridApiRef.current) return;
      const storageKey = `data-platform:grid-cols:${dataSourceId}`;
      const columnState = gridApiRef.current.getColumnState();
      localStorage.setItem(storageKey, JSON.stringify(columnState));
    },
    [dataSourceId],
  );

  /** Cell value changed — trigger auto-save callback */
  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<SpreadsheetRow>) => {
      if (!onCellChange || !event.data) return;

      const field = extractFieldName(event.colDef);
      if (!field || field === "__row_number__" || field === "__drag_handle__") {
        return;
      }

      const cellChangeEvent: CellChangeEvent = {
        rowId: event.data.id,
        field,
        value: event.newValue as unknown,
        previousValue: event.oldValue as unknown,
      };
      onCellChange(cellChangeEvent);
    },
    [onCellChange],
  );

  /** Row number click — open detail panel (D-21) */
  const handleCellClicked = useCallback(
    (event: CellClickedEvent<SpreadsheetRow>) => {
      if (event.colDef.headerName === "#" && event.data && onRowDetailOpen) {
        onRowDetailOpen(event.data.id);
      }
    },
    [onRowDetailOpen],
  );

  /** Cell mouse down — range selection (SE-05) */
  const handleGridCellMouseDown = useCallback(
    (event: CellMouseDownEvent<SpreadsheetRow>) => {
      const colId = event.colDef.colId ?? event.colDef.field;
      if (!colId || event.rowIndex === null || event.rowIndex === undefined)
        return;
      // Skip utility columns
      if (colId === "__row_number__" || colId === "__drag_handle__") return;
      const nativeEvent = event.event as MouseEvent;
      handleCellMouseDown(event.rowIndex, colId, nativeEvent.shiftKey);
    },
    [handleCellMouseDown],
  );

  /** Row drag end — call reorder callback */
  const handleRowDragEnd = useCallback(
    (event: RowDragEndEvent<SpreadsheetRow>) => {
      if (!onRowReorder || !event.node.data) return;
      onRowReorder(event.node.data.id, event.overIndex ?? 0);
    },
    [onRowReorder],
  );

  // ---- Column management handlers (D-10) ----

  /** Handle header cell click — open add column dialog for "+" column */
  const handleHeaderCellClicked = useCallback(
    (event: ColumnHeaderClickedEvent<SpreadsheetRow>) => {
      const col = event.column as Column;
      if (
        typeof col.getColId === "function" &&
        col.getColId() === "__add_column__" &&
        isEditable
      ) {
        setShowAddColumn(true);
      }
    },
    [isEditable],
  );

  /** Handle column moved — persist column order to localStorage */
  const handleColumnMoved = useCallback(
    (event: ColumnMovedEvent<SpreadsheetRow>) => {
      if (!event.finished || !gridApiRef.current) return;
      const storageKey = `data-platform:grid-cols:${dataSourceId}`;
      const columnState = gridApiRef.current.getColumnState();
      localStorage.setItem(storageKey, JSON.stringify(columnState));
    },
    [dataSourceId],
  );

  /** Handle right-click on column header — open context menu */
  const handleColumnHeaderContextMenu = useCallback(
    (event: ColumnHeaderContextMenuEvent<SpreadsheetRow>) => {
      const col = event.column as Column;
      if (typeof col.getColId !== "function") return;
      const colId = col.getColId();
      if (
        !colId ||
        colId === "__drag_handle__" ||
        colId === "__row_number__" ||
        colId === "__add_column__"
      )
        return;

      const schemaCol = columns.find((c) => c.name === colId);
      const colType: SchemaFieldType = schemaCol?.type ?? "text";
      setContextMenuColumn({
        name: colId,
        type: colType,
        triggerKey: `${colId}-${Date.now()}`,
      });
    },
    [columns],
  );

  const handleColumnMenuRename = useCallback(
    (oldName: string, newName: string) => {
      setContextMenuColumn(null);
      onColumnRename?.(oldName, newName);
    },
    [onColumnRename],
  );

  const handleColumnMenuChangeType = useCallback(
    (name: string, newType: SchemaFieldType) => {
      onColumnChangeType?.(name, newType);
    },
    [onColumnChangeType],
  );

  const handleColumnMenuHide = useCallback((name: string) => {
    gridApiRef.current?.setColumnsVisible([name], false);
    setContextMenuColumn(null);
  }, []);

  const handleColumnMenuFreeze = useCallback((name: string) => {
    const col = gridApiRef.current
      ?.getAllGridColumns()
      .find((c) => c.getColId() === name);
    if (!col) return;
    const isPinned = col.isPinnedLeft();
    gridApiRef.current?.setColumnsPinned([name], isPinned ? null : "left");
    setContextMenuColumn(null);
  }, []);

  const handleColumnMenuDelete = useCallback(
    (name: string) => {
      setContextMenuColumn(null);
      onColumnDelete?.(name);
    },
    [onColumnDelete],
  );

  /** Open conditional formatting dialog for a column (D-15) */
  const handleConditionalFormatting = useCallback((columnName: string) => {
    setCfDialogColumn(columnName);
  }, []);

  /** Save formatting rules from dialog */
  const handleCfSave = useCallback(
    (columnName: string, rules: readonly FormatRule[]) => {
      const updated: FormattingRules = {
        ...(formattingRules ?? {}),
        [columnName]: rules,
      };
      onFormattingRulesChange?.(updated);
      setCfDialogColumn(null);
    },
    [formattingRules, onFormattingRulesChange],
  );

  const handleColumnAdd = useCallback(
    (name: string, type: SchemaFieldType) => {
      onColumnAdd?.(name, type);
    },
    [onColumnAdd],
  );

  /** Get visible data column IDs for range selection keyboard handling */
  const getVisibleColIds = useCallback((): string[] => {
    const api = gridApiRef.current;
    if (!api) return [];
    return api
      .getAllDisplayedColumns()
      .map((col) => col.getColId())
      .filter((id) => id !== "__row_number__" && id !== "__drag_handle__");
  }, []);

  /** Unified keyboard handler for the grid container */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const api = gridApiRef.current;

      // Ctrl+Shift+Plus — add row
      if (event.ctrlKey && event.shiftKey && event.key === "+" && isEditable) {
        event.preventDefault();
        onRowAdd?.();
        return;
      }

      // Ctrl+F — open find bar
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
        find.open();
        return;
      }

      // Ctrl+C — copy
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        void handleCopy();
        return;
      }

      // Ctrl+V — paste
      if ((event.ctrlKey || event.metaKey) && event.key === "v" && isEditable) {
        void (async () => {
          try {
            const text = await navigator.clipboard.readText();
            const focusedCell = api?.getFocusedCell();
            if (!focusedCell) return;
            const startColId = focusedCell.column.getColId();
            const visibleColIds = getVisibleColIds();

            // Show confirmation dialog
            const parsed = text.trimEnd().split("\n");
            const rowCount = parsed.length;
            const colCount = Math.max(
              ...parsed.map((r) => r.split("\t").length),
              0,
            );
            const totalCells = rowCount * colCount;

            if (totalCells > 1) {
              setPendingPaste({
                text,
                startRowIndex: focusedCell.rowIndex,
                startColId,
                visibleColIds,
                rowCount,
                colCount,
              });
            } else {
              // Single cell paste — no dialog needed
              await handlePaste(
                text,
                focusedCell.rowIndex,
                startColId,
                visibleColIds,
              );
            }
          } catch {
            // Clipboard read failed — ignore
          }
        })();
        return;
      }

      // Delete/Backspace — clear selected cells (when not editing)
      if (
        isEditable &&
        (event.key === "Delete" || event.key === "Backspace") &&
        !api?.getEditingCells().length
      ) {
        handleDelete();
        return;
      }

      // Shift+Arrow — extend range selection
      if (
        event.shiftKey &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        const focusedCell = api?.getFocusedCell();
        if (!focusedCell) return;
        const focusedCellPos = {
          rowIndex: focusedCell.rowIndex,
          colId: focusedCell.column.getColId(),
        };
        const visibleColIds = getVisibleColIds();
        const totalRows = api?.getDisplayedRowCount() ?? 0;
        handleRangeKeyDown(event, focusedCellPos, totalRows, visibleColIds);
        return;
      }

      // Ctrl+A — select all
      if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        const visibleColIds = getVisibleColIds();
        const totalRows = api?.getDisplayedRowCount() ?? 0;
        handleRangeKeyDown(event, null, totalRows, visibleColIds);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [
    isEditable,
    onRowAdd,
    find,
    handleCopy,
    handlePaste,
    handleDelete,
    handleRangeKeyDown,
    getVisibleColIds,
  ]);

  /** CSV Export (D-19) */
  const handleExportCsv = useCallback(() => {
    gridApiRef.current?.exportDataAsCsv({
      fileName: `records-${dataSourceId}.csv`,
    });
  }, [dataSourceId]);

  /** Confirm paste from dialog */
  const confirmPaste = useCallback(() => {
    if (!pendingPaste) return;
    const paste = pendingPaste;
    setPendingPaste(null);
    void handlePaste(
      paste.text,
      paste.startRowIndex,
      paste.startColId,
      paste.visibleColIds,
    );
  }, [pendingPaste, handlePaste]);

  /** Cancel paste from dialog */
  const cancelPaste = useCallback(() => {
    setPendingPaste(null);
    if (pasteResolveRef.current) {
      pasteResolveRef.current(false);
      pasteResolveRef.current = null;
    }
  }, []);

  const saveStatusText = getSaveStatusText(saveStatus);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col">
        <GridSkeleton />
      </div>
    );
  }

  // Empty state
  if (rows.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="ag-theme-platform flex min-h-[300px] w-full flex-col rounded-md border">
          <GridEmptyState onRowAdd={isEditable ? onRowAdd : undefined} />
        </div>
        {/* Footer even when empty */}
        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Showing 0 of {totalRecords} records
          </span>
          <span className="text-xs text-muted-foreground">
            {saveStatusText}
          </span>
          {isEditable && onRowAdd && (
            <Button variant="secondary" size="sm" onClick={onRowAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" ref={containerRef} tabIndex={-1}>
      {/* Find bar — slides in below toolbar */}
      <div
        className={`overflow-hidden transition-all duration-150 ease-out ${
          find.isOpen ? "max-h-12 opacity-100" : "max-h-0 opacity-0"
        }`}
        aria-hidden={!find.isOpen}
      >
        <div className="flex h-10 items-center gap-2 border-b border-border bg-card px-4">
          <Input
            placeholder="Find in spreadsheet..."
            value={find.query}
            onChange={(e) => find.search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") find.nextMatch();
              if (e.key === "Escape") find.close();
            }}
            className="h-8 w-64"
            aria-label="Find in spreadsheet"
          />
          <span
            className="text-xs text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {find.matchCount > 0
              ? `${find.currentMatchIndex} of ${find.matchCount} matches`
              : find.query
                ? "No matches found"
                : ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={find.prevMatch}
            aria-label="Previous match"
            disabled={find.matchCount === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={find.nextMatch}
            aria-label="Next match"
            disabled={find.matchCount === 0}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={find.close}
            aria-label="Close find"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* AG Grid */}
      <div
        className="ag-theme-platform w-full"
        style={{ height: "600px" }}
        onContextMenu={(event) => {
          // Only handle context menu for editable data sources
          if (!isEditable) return;
          // Only show row menu if at least one row action is wired
          if (!onRowAdd && !onRowDelete) return;

          // Walk up the DOM from the click target to find the AG Grid row element
          let target = event.target as HTMLElement | null;
          let rowId: string | null = null;
          while (target && target !== event.currentTarget) {
            const attr = target.getAttribute("row-id");
            if (attr !== null) {
              rowId = attr;
              break;
            }
            target = target.parentElement;
          }

          // If the click was not on a data row, do nothing (let browser default show)
          if (!rowId) return;

          event.preventDefault();
          setContextMenuRow({
            rowId,
            position: { x: event.clientX, y: event.clientY },
            triggerKey: `${rowId}-${Date.now()}`,
          });
        }}
      >
        <AgGridReact<SpreadsheetRow>
          theme={platformTheme}
          rowData={rows as SpreadsheetRow[]}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          // Editing (D-01)
          singleClickEdit={isEditable}
          stopEditingWhenCellsLoseFocus={true}
          // Undo/redo (D-05, SE-06)
          undoRedoCellEditing={isEditable}
          undoRedoCellEditingLimit={50}
          // Row drag-to-reorder (SE-04)
          rowDragManaged={isEditable}
          animateRows={false}
          // Row selection
          rowSelection="multiple"
          // Callbacks
          onGridReady={handleGridReady}
          onColumnResized={handleColumnResized}
          onColumnMoved={handleColumnMoved}
          onCellValueChanged={handleCellValueChanged}
          onCellClicked={handleCellClicked}
          onCellMouseDown={handleGridCellMouseDown}
          onRowDragEnd={handleRowDragEnd}
          onColumnHeaderClicked={handleHeaderCellClicked}
          onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
          suppressContextMenu={true}
          // Performance
          suppressColumnVirtualisation={false}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-card px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Showing 1-{rows.length} of {totalRecords} records
          {hasMore ? "+" : ""}
        </span>
        <span className="text-xs text-muted-foreground">{saveStatusText}</span>
        <div className="flex items-center gap-2">
          {/* CSV Export (D-19) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            aria-label="Export as CSV"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {hasMore && onLoadMore && (
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              Load more
            </Button>
          )}
          {isEditable && onRowAdd && (
            <Button variant="secondary" size="sm" onClick={onRowAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          )}
        </div>
      </div>

      {/* Paste preview dialog (D-19) */}
      <Dialog
        open={pendingPaste !== null}
        onOpenChange={(open) => {
          if (!open) cancelPaste();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Paste {pendingPaste?.rowCount} rows &times;{" "}
              {pendingPaste?.colCount} columns?
            </DialogTitle>
            <DialogDescription>
              This will fill{" "}
              {(pendingPaste?.rowCount ?? 0) * (pendingPaste?.colCount ?? 0)}{" "}
              cells starting at the selected cell.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelPaste}>
              Cancel
            </Button>
            <Button variant="default" onClick={confirmPaste}>
              Paste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column header context menu (D-10) — rendered at grid level, opened on right-click */}
      {contextMenuColumn && (
        <ColumnHeaderMenu
          key={contextMenuColumn.triggerKey}
          columnName={contextMenuColumn.name}
          columnType={contextMenuColumn.type}
          isEditable={isEditable}
          open={true}
          onOpenChange={(open) => {
            if (!open) setContextMenuColumn(null);
          }}
          onRename={handleColumnMenuRename}
          onChangeType={handleColumnMenuChangeType}
          onHide={handleColumnMenuHide}
          onDelete={handleColumnMenuDelete}
          onFreeze={handleColumnMenuFreeze}
          onConditionalFormatting={handleConditionalFormatting}
        >
          {/* Hidden trigger — menu opens programmatically via open=true */}
          <span
            style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
          />
        </ColumnHeaderMenu>
      )}

      {/* Row context menu — rendered at grid level, opened on right-click of data row */}
      {contextMenuRow && isEditable && (
        <RowContextMenu
          key={contextMenuRow.triggerKey}
          rowId={contextMenuRow.rowId}
          position={contextMenuRow.position}
          triggerKey={contextMenuRow.triggerKey}
          onAddRow={onRowAdd}
          onDeleteRow={onRowDelete}
          onClose={() => setContextMenuRow(null)}
        />
      )}

      {/* Add column dialog (D-10) */}
      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAdd={handleColumnAdd}
        existingNames={columns.map((c) => c.name)}
      />

      {/* Conditional formatting dialog (D-15) */}
      {cfDialogColumn !== null && (
        <ConditionalFormattingDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setCfDialogColumn(null);
          }}
          columnName={cfDialogColumn}
          rules={formattingRules?.[cfDialogColumn] ?? []}
          onSave={handleCfSave}
        />
      )}
    </div>
  );
}
