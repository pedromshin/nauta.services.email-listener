import type {
  CellClassParams,
  ColDef,
  ITooltipParams,
  ValueGetterParams,
  ValueSetterParams,
} from "ag-grid-community";

import type { SpreadsheetColumn, SpreadsheetRow } from "./types";
import { ArrayCellEditor } from "./cell-editors/ArrayCellEditor";
import { BooleanCellEditor } from "./cell-editors/BooleanCellEditor";
import { DateCellEditor } from "./cell-editors/DateCellEditor";
import { JsonCellEditor } from "./cell-editors/JsonCellEditor";
import { NumberCellEditor } from "./cell-editors/NumberCellEditor";
import { SelectCellEditor } from "./cell-editors/SelectCellEditor";
import { TextCellEditor } from "./cell-editors/TextCellEditor";
import { ArrayCellRenderer } from "./cell-renderers/ArrayCellRenderer";
import { BooleanCellRenderer } from "./cell-renderers/BooleanCellRenderer";
import { DateCellRenderer } from "./cell-renderers/DateCellRenderer";
import { NumberCellRenderer } from "./cell-renderers/NumberCellRenderer";
import { validateCellValue } from "./validation";

/** Row number column — pinned left, non-editable (D-14) */
const ROW_NUMBER_COLUMN: ColDef<SpreadsheetRow> = {
  headerName: "#",
  colId: "__row_number__",
  pinned: "left",
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  editable: false,
  sortable: false,
  resizable: false,
  suppressMovable: true,
  valueGetter: (params: ValueGetterParams<SpreadsheetRow>) =>
    (params.node?.rowIndex ?? 0) + 1,
  cellClass:
    "cursor-pointer text-center text-muted-foreground text-xs select-none",
};

function getRendererAndEditor(
  col: SpreadsheetColumn,
): Partial<ColDef<SpreadsheetRow>> {
  switch (col.type) {
    case "date":
      return {
        cellRenderer: DateCellRenderer,
        cellEditor: DateCellEditor,
      };
    case "number":
      return {
        cellRenderer: NumberCellRenderer,
        cellEditor: NumberCellEditor,
      };
    case "boolean":
      return {
        cellRenderer: BooleanCellRenderer,
        cellEditor: BooleanCellEditor,
      };
    case "url":
    case "email":
    case "text":
      return {
        cellEditor: TextCellEditor,
      };
    case "enum":
      return {
        cellEditor: SelectCellEditor,
        cellEditorParams: { values: col.enumValues ?? [] },
      };
    case "json":
      return {
        cellEditor: JsonCellEditor,
        cellEditorPopup: true,
      };
    case "array":
      return {
        cellRenderer: ArrayCellRenderer,
        cellEditor: ArrayCellEditor,
        cellEditorPopup: false,
      };
    default:
      return { cellEditor: TextCellEditor };
  }
}

/**
 * Builds AG Grid ColDef[] from SpreadsheetColumn[].
 * Includes row number column, JSONB valueGetter/valueSetter,
 * type-specific renderers/editors, and D-04 validation wiring.
 */
export function buildColumnDefs(
  columns: readonly SpreadsheetColumn[],
  isEditable: boolean,
): ColDef<SpreadsheetRow>[] {
  const dataCols: ColDef<SpreadsheetRow>[] = columns.map((col) => {
    const rendererEditor = getRendererAndEditor(col);

    const colDef: ColDef<SpreadsheetRow> = {
      headerName: col.name,
      colId: col.name,
      editable: isEditable,
      resizable: true,
      sortable: true,
      filter: true,

      // JSONB valueGetter/valueSetter — reads from data[fieldName] (Pitfall 2)
      valueGetter: (params: ValueGetterParams<SpreadsheetRow>) =>
        params.data?.data?.[col.name],
      valueSetter: (params: ValueSetterParams<SpreadsheetRow>) => {
        if (!params.data) return false;
        // Immutable update: spread the row and its data object
        const updated: SpreadsheetRow = {
          ...params.data,
          data: { ...params.data.data, [col.name]: params.newValue as unknown },
        };
        Object.assign(params.data, updated);
        return true;
      },

      // D-04 validation: red border class + tooltip with error message
      cellClassRules: {
        "cell-error": (params: CellClassParams<SpreadsheetRow>) =>
          !validateCellValue(params.value, col).valid,
      },
      tooltipValueGetter: (params: ITooltipParams<SpreadsheetRow>) =>
        validateCellValue(params.value, col).message,

      // Auto-detected columns get header styling (D-11)
      ...(col.autoDetected ? { headerClass: "auto-detected" } : {}),

      ...rendererEditor,
    };

    return colDef;
  });

  return [ROW_NUMBER_COLUMN, ...dataCols];
}
