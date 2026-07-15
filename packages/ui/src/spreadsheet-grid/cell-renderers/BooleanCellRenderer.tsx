import type { ICellRendererParams } from "ag-grid-community";
import type { JSX } from "react";

import { Checkbox } from "../../checkbox";

/** Renders a read-only checkbox for boolean values (D-09) */
export function BooleanCellRenderer(
  params: ICellRendererParams,
): JSX.Element | null {
  const value: unknown = params.value;

  if (value === null || value === undefined) {
    return null;
  }

  return (
    <div className="pointer-events-none flex h-full w-full items-center justify-center">
      <Checkbox checked={!!value} disabled aria-readonly="true" />
    </div>
  );
}
