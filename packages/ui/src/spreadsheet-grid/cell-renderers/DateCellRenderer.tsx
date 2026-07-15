import type { ICellRendererParams } from "ag-grid-community";
import { format, isValid, parseISO } from "date-fns";
import type { JSX } from "react";

/** Formats a date value as "Mar 24, 2026" (D-09) */
export function DateCellRenderer(
  params: ICellRendererParams,
): JSX.Element | null {
  const value: unknown = params.value;

  if (value === null || value === undefined || value === "") {
    return null;
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = parseISO(value);
  } else if (typeof value === "number") {
    date = new Date(value);
  } else {
    return (
      <span className="text-muted-foreground">
        {typeof value === "string" ? value : "Invalid"}
      </span>
    );
  }

  if (!isValid(date)) {
    return (
      <span className="text-muted-foreground">
        {typeof value === "string" ? value : "Invalid"}
      </span>
    );
  }

  return <span>{format(date, "MMM d, yyyy")}</span>;
}
