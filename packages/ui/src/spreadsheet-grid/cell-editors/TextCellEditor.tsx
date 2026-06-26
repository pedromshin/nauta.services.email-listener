"use client";

import type { ICellEditorParams } from "ag-grid-community";
import * as React from "react";

import { Input } from "../../input";

/** Inline text editor for text, url, and email fields (D-08) */
export const TextCellEditor = React.forwardRef<
  { getValue: () => string },
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
    getValue: () => value,
  }));

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="h-full w-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      aria-label={String(params.colDef?.headerName ?? "Cell")}
    />
  );
});

TextCellEditor.displayName = "TextCellEditor";
