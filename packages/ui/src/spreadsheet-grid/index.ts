// Types
export type {
  CellChangeEvent,
  FormatColor,
  FormatCondition,
  FormatRule,
  FormattingRules,
  SaveStatus,
  SchemaFieldType,
  SpreadsheetColumn,
  SpreadsheetGridProps,
  SpreadsheetRow,
} from "./types";

// Main component
export { SpreadsheetGrid } from "./SpreadsheetGrid";

// Column management components
export { ColumnHeaderMenu } from "./column-header-menu";
export type { ColumnHeaderMenuProps } from "./column-header-menu";
export { AddColumnDialog } from "./add-column-dialog";
export type { AddColumnDialogProps } from "./add-column-dialog";

// Conditional formatting (D-15)
export { ConditionalFormattingDialog } from "./conditional-formatting-dialog";
export type { ConditionalFormattingDialogProps } from "./conditional-formatting-dialog";

// Column definitions builder
export { buildColumnDefs } from "./column-defs";

// Validation
export { validateCellValue } from "./validation";
export type { ValidationResult } from "./validation";

// Cell renderers
export { DateCellRenderer } from "./cell-renderers/DateCellRenderer";
export { NumberCellRenderer } from "./cell-renderers/NumberCellRenderer";
export { BooleanCellRenderer } from "./cell-renderers/BooleanCellRenderer";
export { UrlCellRenderer } from "./cell-renderers/UrlCellRenderer";
export { ArrayCellRenderer } from "./cell-renderers/ArrayCellRenderer";

// Hooks
export { useConditionalFormatting } from "./hooks/use-conditional-formatting";
export type { UseConditionalFormattingReturn } from "./hooks/use-conditional-formatting";
export { useRangeSelection } from "./hooks/use-range-selection";
export type {
  CellPosition,
  RangeSelection,
  SelectedCellValue,
} from "./hooks/use-range-selection";
export { useGridClipboard } from "./hooks/use-grid-clipboard";
export type { UseGridClipboardReturn } from "./hooks/use-grid-clipboard";
export { useGridFind } from "./hooks/use-grid-find";
export type { FindMatch, UseGridFindReturn } from "./hooks/use-grid-find";

// Cell editors
export { TextCellEditor } from "./cell-editors/TextCellEditor";
export { NumberCellEditor } from "./cell-editors/NumberCellEditor";
export { DateCellEditor } from "./cell-editors/DateCellEditor";
export { BooleanCellEditor } from "./cell-editors/BooleanCellEditor";
export { SelectCellEditor } from "./cell-editors/SelectCellEditor";
export { JsonCellEditor } from "./cell-editors/JsonCellEditor";
export { ArrayCellEditor } from "./cell-editors/ArrayCellEditor";
