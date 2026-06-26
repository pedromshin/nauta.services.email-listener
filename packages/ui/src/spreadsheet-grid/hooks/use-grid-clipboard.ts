import type { GridApi } from "ag-grid-community";
import { useCallback } from "react";

import type { RangeSelection, SelectedCellValue } from "./use-range-selection";

/** A parsed tabular clipboard row: array of cell string values */
type ClipboardRow = readonly string[];

/** Parsed clipboard data: rows of cell values */
interface ParsedClipboard {
  readonly rows: readonly ClipboardRow[];
  readonly rowCount: number;
  readonly colCount: number;
}

/** Parses tab-separated clipboard text into a 2D array of strings */
function parseTabSeparated(text: string): ParsedClipboard {
  const rows = text
    .trimEnd()
    .split("\n")
    .map((line) => line.split("\t"));

  const rowCount = rows.length;
  const colCount = Math.max(...rows.map((r) => r.length), 0);

  return { rows, rowCount, colCount };
}

/** Builds tab-separated text from selected cells ordered by row then column */
function buildTabSeparated(
  cells: readonly SelectedCellValue[],
  rowCount: number,
  colCount: number,
  startRowIndex: number,
  colIds: readonly string[],
): string {
  const lines: string[] = [];

  for (let r = 0; r < rowCount; r++) {
    const rowCells: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const rowIdx = startRowIndex + r;
      const colId = colIds[c];
      const cell = cells.find(
        (cell) => cell.rowIndex === rowIdx && cell.colId === colId,
      );
      const cellValue = cell?.value;
      let cellStr: string;
      if (cellValue === null || cellValue === undefined) {
        cellStr = "";
      } else if (typeof cellValue === "object") {
        cellStr = JSON.stringify(cellValue);
      } else if (
        typeof cellValue === "string" ||
        typeof cellValue === "number" ||
        typeof cellValue === "boolean"
      ) {
        cellStr = `${cellValue}`;
      } else {
        cellStr = "";
      }
      rowCells.push(cellStr);
    }
    lines.push(rowCells.join("\t"));
  }

  return lines.join("\n");
}

export interface UseGridClipboardReturn {
  readonly handleCopy: () => Promise<void>;
  readonly handlePaste: (
    clipboardText: string,
    startRowIndex: number,
    startColId: string,
    visibleColIds: readonly string[],
  ) => Promise<void>;
  readonly handleDelete: () => void;
}

/**
 * Provides clipboard copy/paste/delete functionality for AG Grid Community.
 * Copy writes tab-separated text to system clipboard.
 * Paste shows a confirmation dialog before writing cells.
 * Delete clears cell values in the selected range.
 */
export function useGridClipboard(
  gridApi: GridApi | null,
  rangeSelection: RangeSelection | null,
  getSelectedCells: (api: GridApi) => SelectedCellValue[],
  onPasteConfirm?: (rowCount: number, colCount: number) => Promise<boolean>,
): UseGridClipboardReturn {
  const handleCopy = useCallback(async () => {
    if (!gridApi || !rangeSelection) return;

    const cells = getSelectedCells(gridApi);
    if (cells.length === 0) return;

    const rowCount =
      rangeSelection.end.rowIndex - rangeSelection.start.rowIndex + 1;

    // Collect unique column IDs in order
    const colIdSet = new Set<string>();
    for (const cell of cells) {
      colIdSet.add(cell.colId);
    }
    const colIds = [...colIdSet];
    const colCount = colIds.length;

    const text = buildTabSeparated(
      cells,
      rowCount,
      colCount,
      rangeSelection.start.rowIndex,
      colIds,
    );

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard write failed — silently ignore (browser permissions)
    }
  }, [gridApi, rangeSelection, getSelectedCells]);

  const handlePaste = useCallback(
    async (
      clipboardText: string,
      startRowIndex: number,
      startColId: string,
      visibleColIds: readonly string[],
    ) => {
      if (!gridApi) return;

      const parsed = parseTabSeparated(clipboardText);
      if (parsed.rowCount === 0) return;

      // Ask for confirmation if handler provided
      if (onPasteConfirm) {
        const confirmed = await onPasteConfirm(
          parsed.rowCount,
          parsed.colCount,
        );
        if (!confirmed) return;
      }

      const startColIdx = visibleColIds.indexOf(startColId);
      if (startColIdx === -1) return;

      for (let r = 0; r < parsed.rows.length; r++) {
        const rowIdx = startRowIndex + r;
        const rowNode = gridApi.getDisplayedRowAtIndex(rowIdx);
        if (!rowNode) continue;

        const clipRow = parsed.rows[r];
        if (!clipRow) continue;

        for (let c = 0; c < clipRow.length; c++) {
          const colId = visibleColIds[startColIdx + c];
          if (!colId) continue;

          const cellValue = clipRow[c] ?? "";
          rowNode.setDataValue(colId, cellValue);
        }
      }
    },
    [gridApi, onPasteConfirm],
  );

  const handleDelete = useCallback(() => {
    if (!gridApi || !rangeSelection) return;

    const cells = getSelectedCells(gridApi);
    for (const cell of cells) {
      const rowNode = gridApi.getDisplayedRowAtIndex(cell.rowIndex);
      if (!rowNode) continue;
      rowNode.setDataValue(cell.colId, null);
    }
  }, [gridApi, rangeSelection, getSelectedCells]);

  return { handleCopy, handlePaste, handleDelete };
}
