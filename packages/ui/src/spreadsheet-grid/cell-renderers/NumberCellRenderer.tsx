import type { ICellRendererParams } from "ag-grid-community";
import type { JSX } from "react";

const numberFormatter = new Intl.NumberFormat("en-US");

/** Formats numbers as "1,234.56" with right-alignment (D-09) */
export function NumberCellRenderer(
  params: ICellRendererParams,
): JSX.Element | null {
  const value: unknown = params.value;

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return (
      <span className="inline-block w-full text-right">
        {typeof value === "string" ? value : "NaN"}
      </span>
    );
  }

  return (
    <span className="inline-block w-full text-right">
      {numberFormatter.format(numeric)}
    </span>
  );
}
