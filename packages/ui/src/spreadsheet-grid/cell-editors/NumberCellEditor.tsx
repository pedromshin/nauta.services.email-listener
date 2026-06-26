"use client";

import type { ICellEditorParams } from "ag-grid-community";
import * as React from "react";

import { Input } from "../../input";

/** Inline number editor with step arrows (D-08) */
export const NumberCellEditor = React.forwardRef<
  { getValue: () => number | null },
  ICellEditorParams
>((params, ref) => {
  const [value, setValue] = React.useState<string>(
    params.value !== null && params.value !== undefined
      ? String(params.value)
      : "",
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      if (value === "" || value === null) return null;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    },
  }));

  return (
    <Input
      ref={inputRef}
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="h-full w-full rounded-none border-0 bg-transparent text-right shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      aria-label={String(params.colDef?.headerName ?? "Number")}
    />
  );
});

NumberCellEditor.displayName = "NumberCellEditor";
