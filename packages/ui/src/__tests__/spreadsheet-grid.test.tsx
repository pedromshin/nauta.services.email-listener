/**
 * Wave 0 test stubs for Phase 07 — Data Source Spreadsheet Editor
 *
 * SE-01: SpreadsheetGrid component rendering
 * SE-03: Schema-aware column rendering
 * SE-05: Keyboard navigation
 *
 * These stubs are pending until the SpreadsheetGrid component is implemented
 * in 07-02. They define the expected behaviors first (Nyquist rule).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("ag-grid-react", () => ({
  AgGridReact: ({ className }: { className?: string }) => (
    <div data-testid="ag-grid" className={className} />
  ),
}));

vi.mock("ag-grid-community", () => ({
  ModuleRegistry: { registerModules: vi.fn() },
  ClientSideRowModelModule: {},
  CellStyleModule: {},
  CheckboxEditorModule: {},
  DateEditorModule: {},
  NumberEditorModule: {},
  TextEditorModule: {},
  SelectEditorModule: {},
  RowDragModule: {},
  RangeSelectionModule: {},
  ClipboardModule: {},
  CsvExportModule: {},
  KeyCreatorModule: {},
  UndoRedoEditModule: {},
  ColumnApiModule: {},
  ValidationModule: {},
}));

// ---------------------------------------------------------------------------
// SE-01 — SpreadsheetGrid component rendering
// ---------------------------------------------------------------------------

describe("SpreadsheetGrid (SE-01)", () => {
  it.todo("renders AG Grid with provided rows and columns");
  // Expected: SpreadsheetGrid mounts and renders an element with class "ag-theme-platform"
  // and the data-testid="ag-grid" from the mock

  it.todo("shows skeleton loading state when isLoading is true");
  // Expected: when isLoading={true}, render Skeleton elements visible in the DOM

  it.todo("shows empty state when rows is empty and not loading");
  // Expected: text "No records yet" visible in the DOM

  it.todo("renders footer with record count");
  // Expected: text matching /Showing/ visible in the DOM footer area
});

// ---------------------------------------------------------------------------
// SE-03 — Schema-aware column rendering
// ---------------------------------------------------------------------------

describe("Column renderers (SE-03)", () => {
  it.todo("renders date values using DateCellRenderer format");
  // Input: ISO date string "2026-03-24T00:00:00Z"
  // Expected output: "Mar 24, 2026" formatted via Intl.DateTimeFormat

  it.todo("renders number values with Intl.NumberFormat");
  // Input: 1234
  // Expected output: "1,234" formatted string

  it.todo("renders boolean values as checkbox");
  // Input: true
  // Expected: checkbox input element in DOM

  it.todo("renders url values with external link icon");
  // Input: "https://example.com"
  // Expected: ExternalLink lucide icon present

  it.todo("renders array values as badges");
  // Input: ["tag1", "tag2"]
  // Expected: Badge components for each array element

  it("buildColumnDefs produces ColDef[] with correct valueGetter for JSONB", () => {
    // This tests the pure function contract without needing a rendered component.
    // The function maps schema fields to AG Grid ColDef with valueGetter reading from data[fieldName].
    interface SchemaField {
      name: string;
      type: string;
      required?: boolean;
    }
    interface ColDef {
      field: string;
      valueGetter: (params: { data: Record<string, unknown> }) => unknown;
    }

    // Stub implementation contract — buildColumnDefs will be implemented in 07-02
    // and must satisfy: valueGetter reads from params.data[field.name]
    const stubBuildColumnDefs = (fields: SchemaField[]): ColDef[] =>
      fields.map((f) => ({
        field: f.name,
        valueGetter: (params: { data: Record<string, unknown> }) =>
          params.data[f.name],
      }));

    const fields: SchemaField[] = [{ name: "revenue", type: "number" }];
    const defs = stubBuildColumnDefs(fields);

    expect(defs).toHaveLength(1);
    expect(defs[0]?.field).toBe("revenue");
    expect(defs[0]?.valueGetter({ data: { revenue: 42 } })).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// SE-05 — Keyboard navigation
// ---------------------------------------------------------------------------

describe("Keyboard navigation (SE-05)", () => {
  it.todo("enters edit mode on single click when isEditable");
  // Expected: grid rendered with singleClickEdit={true} prop when isEditable=true

  it.todo("does not enter edit mode when isEditable is false");
  // Expected: grid rendered with singleClickEdit={false} when isEditable=false

  it.todo("opens find bar on Ctrl+F");
  // Expected: find bar element becomes visible after Ctrl+F keydown event
});
