import type { GridApi } from "ag-grid-community";
import { useCallback, useRef, useState } from "react";

/** An immutable cell position identified by row index and column ID */
export interface CellPosition {
  readonly rowIndex: number;
  readonly colId: string;
}

/** An immutable rectangular range bounded by start and end cell positions */
export interface RangeSelection {
  readonly start: CellPosition;
  readonly end: CellPosition;
}

/** Selected cell value as returned by getSelectedCells */
export interface SelectedCellValue {
  readonly rowIndex: number;
  readonly colId: string;
  readonly value: unknown;
}

export interface UseRangeSelectionReturn {
  readonly range: RangeSelection | null;
  readonly handleCellMouseDown: (
    rowIndex: number,
    colId: string,
    shiftKey: boolean,
  ) => void;
  readonly handleKeyDown: (
    event: KeyboardEvent,
    focusedCell: CellPosition | null,
    totalRows: number,
    visibleColIds: readonly string[],
  ) => void;
  readonly isInRange: (rowIndex: number, colId: string) => boolean;
  readonly clearSelection: () => void;
  readonly getSelectedCells: (gridApi: GridApi) => SelectedCellValue[];
}

/** Normalizes a range so that start always has lower rowIndex/colIndex than end */
function normalizeRange(
  a: CellPosition,
  b: CellPosition,
  colOrder: readonly string[],
): RangeSelection {
  const aColIdx = colOrder.indexOf(a.colId);
  const bColIdx = colOrder.indexOf(b.colId);

  const startRow = Math.min(a.rowIndex, b.rowIndex);
  const endRow = Math.max(a.rowIndex, b.rowIndex);
  const startColIdx = Math.min(aColIdx, bColIdx);
  const endColIdx = Math.max(aColIdx, bColIdx);

  return {
    start: { rowIndex: startRow, colId: colOrder[startColIdx] ?? a.colId },
    end: { rowIndex: endRow, colId: colOrder[endColIdx] ?? b.colId },
  };
}

/**
 * Tracks a rectangular cell range selection for AG Grid Community.
 * Handles Shift+click to extend selection, Shift+Arrow to expand range,
 * and Ctrl+A for full-grid selection.
 */
export function useRangeSelection(): UseRangeSelectionReturn {
  const [range, setRange] = useState<RangeSelection | null>(null);
  const anchorRef = useRef<CellPosition | null>(null);
  // Track column order for normalization — updated on each operation
  const colOrderRef = useRef<string[]>([]);

  const handleCellMouseDown = useCallback(
    (rowIndex: number, colId: string, shiftKey: boolean) => {
      const clicked: CellPosition = { rowIndex, colId };

      if (shiftKey && anchorRef.current) {
        // Extend range from anchor to clicked cell
        const anchor = anchorRef.current;
        const colOrder = colOrderRef.current;
        if (colOrder.length === 0) {
          setRange({ start: anchor, end: clicked });
          return;
        }
        setRange(normalizeRange(anchor, clicked, colOrder));
      } else {
        // New anchor — collapse range to single cell
        anchorRef.current = clicked;
        setRange({ start: clicked, end: clicked });
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (
      event: KeyboardEvent,
      focusedCell: CellPosition | null,
      totalRows: number,
      visibleColIds: readonly string[],
    ) => {
      // Update stored column order reference
      colOrderRef.current = [...visibleColIds];

      // Ctrl+A: select all
      if ((event.ctrlKey || event.metaKey) && event.key === "a") {
        if (visibleColIds.length === 0 || totalRows === 0) return;
        event.preventDefault();
        const firstCol = visibleColIds[0];
        const lastCol = visibleColIds[visibleColIds.length - 1];
        if (!firstCol || !lastCol) return;
        anchorRef.current = { rowIndex: 0, colId: firstCol };
        setRange({
          start: { rowIndex: 0, colId: firstCol },
          end: { rowIndex: totalRows - 1, colId: lastCol },
        });
        return;
      }

      // Shift+Arrow: extend range from anchor
      if (!event.shiftKey) return;
      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!arrowKeys.includes(event.key)) return;

      const anchor = anchorRef.current ?? focusedCell;
      if (!anchor) return;

      // Determine current end of range (or anchor if no range)
      const currentEnd = range?.end ?? anchor;
      const colOrder = visibleColIds;
      const currentColIdx = colOrder.indexOf(currentEnd.colId);

      let nextRowIndex = currentEnd.rowIndex;
      let nextColIdx = currentColIdx;

      switch (event.key) {
        case "ArrowUp":
          nextRowIndex = Math.max(0, currentEnd.rowIndex - 1);
          break;
        case "ArrowDown":
          nextRowIndex = Math.min(totalRows - 1, currentEnd.rowIndex + 1);
          break;
        case "ArrowLeft":
          nextColIdx = Math.max(0, currentColIdx - 1);
          break;
        case "ArrowRight":
          nextColIdx = Math.min(colOrder.length - 1, currentColIdx + 1);
          break;
      }

      const nextColId = colOrder[nextColIdx] ?? currentEnd.colId;
      const nextEnd: CellPosition = {
        rowIndex: nextRowIndex,
        colId: nextColId,
      };

      anchorRef.current ??= anchor;

      event.preventDefault();
      setRange(normalizeRange(anchorRef.current, nextEnd, colOrder));
    },
    [range],
  );

  const isInRange = useCallback(
    (rowIndex: number, colId: string): boolean => {
      if (!range) return false;

      const colOrder = colOrderRef.current;
      const colIdx = colOrder.indexOf(colId);
      const startColIdx = colOrder.indexOf(range.start.colId);
      const endColIdx = colOrder.indexOf(range.end.colId);

      const rowInRange =
        rowIndex >= range.start.rowIndex && rowIndex <= range.end.rowIndex;

      if (colIdx === -1 || startColIdx === -1 || endColIdx === -1) {
        return rowInRange && colId === range.start.colId;
      }

      const colInRange = colIdx >= startColIdx && colIdx <= endColIdx;
      return rowInRange && colInRange;
    },
    [range],
  );

  const clearSelection = useCallback(() => {
    setRange(null);
    anchorRef.current = null;
  }, []);

  const getSelectedCells = useCallback(
    (gridApi: GridApi): SelectedCellValue[] => {
      if (!range) return [];

      const colOrder = colOrderRef.current;
      const startColIdx = colOrder.indexOf(range.start.colId);
      const endColIdx = colOrder.indexOf(range.end.colId);

      if (startColIdx === -1 || endColIdx === -1) return [];

      const selectedColIds = colOrder.slice(
        Math.min(startColIdx, endColIdx),
        Math.max(startColIdx, endColIdx) + 1,
      );

      const results: SelectedCellValue[] = [];

      for (
        let rowIdx = range.start.rowIndex;
        rowIdx <= range.end.rowIndex;
        rowIdx++
      ) {
        const rowNode = gridApi.getDisplayedRowAtIndex(rowIdx);
        if (!rowNode) continue;

        for (const colId of selectedColIds) {
          const value: unknown = rowNode.data
            ? ((rowNode.data as Record<string, unknown>)[colId] ??
              (rowNode.data as { data?: Record<string, unknown> }).data?.[
                colId
              ])
            : undefined;

          results.push({ rowIndex: rowIdx, colId, value });
        }
      }

      return results;
    },
    [range],
  );

  return {
    range,
    handleCellMouseDown,
    handleKeyDown,
    isInRange,
    clearSelection,
    getSelectedCells,
  };
}
