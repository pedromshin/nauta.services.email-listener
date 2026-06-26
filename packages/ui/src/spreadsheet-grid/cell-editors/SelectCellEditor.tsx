"use client";

import type { ICellEditorParams } from "ag-grid-community";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../select";

interface SelectCellEditorParams extends ICellEditorParams {
  readonly values?: readonly string[];
}

/** Enum cell editor with a Select dropdown, opens on mount (D-08) */
export const SelectCellEditor = React.forwardRef<
  { getValue: () => string | null },
  SelectCellEditorParams
>((params, ref) => {
  const [value, setValue] = React.useState<string>(
    params.value !== null && params.value !== undefined
      ? String(params.value)
      : "",
  );

  const options: readonly string[] =
    (params.colDef?.cellEditorParams as { values?: readonly string[] })
      ?.values ??
    params.values ??
    [];

  React.useImperativeHandle(ref, () => ({
    getValue: () => value || null,
  }));

  const handleChange = (next: string) => {
    setValue(next);
    setTimeout(() => params.stopEditing(), 0);
  };

  return (
    <Select value={value} onValueChange={handleChange} open>
      <SelectTrigger
        className="h-full w-full rounded-none border-0 shadow-none focus:ring-0"
        aria-label={String(params.colDef?.headerName ?? "Select")}
      >
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

SelectCellEditor.displayName = "SelectCellEditor";
