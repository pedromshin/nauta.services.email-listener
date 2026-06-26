/** Supported schema field types for column rendering (per D-08) */
export type SchemaFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "url"
  | "email"
  | "enum"
  | "json"
  | "array";

/** A column definition derived from the data source schema */
export interface SpreadsheetColumn {
  readonly name: string;
  readonly type: SchemaFieldType;
  readonly required?: boolean;
  readonly enumValues?: readonly string[];
  readonly description?: string;
  /** True if this column was auto-detected from JSONB keys (D-11) */
  readonly autoDetected?: boolean;
}

/** A record row as consumed by the grid */
export interface SpreadsheetRow {
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly title?: string | null;
  readonly subtitle?: string | null;
  readonly recordType?: string;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

/** Callback for cell value changes (used by auto-save) */
export interface CellChangeEvent {
  readonly rowId: string;
  readonly field: string;
  readonly value: unknown;
  readonly previousValue: unknown;
}

/** Save status for the footer indicator */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Conditional formatting types (D-15, plan 07-07)
// ---------------------------------------------------------------------------

export type FormatCondition =
  | "greater_than"
  | "less_than"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "not_empty"
  | "is_empty";

export type FormatColor =
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"
  | "chart-6"
  | "chart-7"
  | "chart-8";

export interface FormatRule {
  readonly id: string;
  readonly condition: FormatCondition;
  readonly value: string | number | null;
  readonly color: FormatColor;
}

export type FormattingRules = Record<string, readonly FormatRule[]>;

// ---------------------------------------------------------------------------

/** Props for the SpreadsheetGrid component */
export interface SpreadsheetGridProps {
  /** Row data to display */
  readonly rows: readonly SpreadsheetRow[];
  /** Schema-derived columns */
  readonly columns: readonly SpreadsheetColumn[];
  /** Whether cells are editable (false for synced sources per D-17) */
  readonly isEditable: boolean;
  /** Data source ID for localStorage column state key */
  readonly dataSourceId: string;
  /** Current save status for footer */
  readonly saveStatus: SaveStatus;
  /** Total record count for footer */
  readonly totalRecords: number;
  /** Called when a cell value changes */
  readonly onCellChange?: (event: CellChangeEvent) => void;
  /** Called when a new row should be added */
  readonly onRowAdd?: () => void;
  /** Called when a row should be deleted */
  readonly onRowDelete?: (rowId: string) => void;
  /** Called when a row number is clicked (opens detail panel) */
  readonly onRowDetailOpen?: (rowId: string) => void;
  /** Called when loading more rows (pagination) */
  readonly onLoadMore?: () => void;
  /** Whether more rows are available */
  readonly hasMore?: boolean;
  /** Whether initial data is loading */
  readonly isLoading?: boolean;
  /** Called when a row is dragged to a new position (SE-04 reorder) */
  readonly onRowReorder?: (rowId: string, newIndex: number) => void;
  /** Called when a new column should be added to the schema (D-10) */
  readonly onColumnAdd?: (name: string, type: SchemaFieldType) => void;
  /** Called when a column is renamed (D-10) */
  readonly onColumnRename?: (oldName: string, newName: string) => void;
  /** Called when a column type changes (D-10) */
  readonly onColumnChangeType?: (
    name: string,
    newType: SchemaFieldType,
  ) => void;
  /** Called when a column is deleted (D-10) */
  readonly onColumnDelete?: (name: string) => void;
  /** Conditional formatting rules per column (D-15) */
  readonly formattingRules?: FormattingRules;
  /** Called when formatting rules change (D-15) */
  readonly onFormattingRulesChange?: (rules: FormattingRules) => void;
}
