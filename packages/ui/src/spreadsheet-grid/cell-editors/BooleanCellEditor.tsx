"use client";

import type { ICellEditorParams } from "ag-grid-community";
import * as React from "react";

import { Checkbox } from "../../checkbox";

/** Boolean cell editor — flips value immediately and stops editing (D-08) */
export const BooleanCellEditor = React.forwardRef<
  { getValue: () => boolean },
  ICellEditorParams
>((params, ref) => {
  const [checked, setChecked] = React.useState<boolean>(!!params.value);

  React.useImperativeHandle(ref, () => ({
    getValue: () => checked,
  }));

  const handleChange = (value: boolean | "indeterminate") => {
    const next = value === "indeterminate" ? false : value;
    setChecked(next);
    // Defer stopEditing so getValue() captures the latest state
    setTimeout(() => params.stopEditing(), 0);
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Checkbox
        checked={checked}
        onCheckedChange={handleChange}
        aria-label={String(params.colDef?.headerName ?? "Boolean")}
      />
    </div>
  );
});

BooleanCellEditor.displayName = "BooleanCellEditor";
