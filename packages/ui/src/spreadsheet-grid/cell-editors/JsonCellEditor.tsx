"use client";

import type { ICellEditorParams } from "ag-grid-community";
import * as React from "react";

import { Button } from "../../button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../dialog";

/** JSON cell editor with a modal textarea and validation (D-08) */
export const JsonCellEditor = React.forwardRef<
  { getValue: () => unknown },
  ICellEditorParams
>((params, ref) => {
  const initialText = (() => {
    if (params.value === null || params.value === undefined) return "";
    if (typeof params.value === "string") return params.value;
    try {
      return JSON.stringify(params.value, null, 2);
    } catch {
      return String(params.value);
    }
  })();

  const [text, setText] = React.useState<string>(initialText);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(true);
  const parsedRef = React.useRef<unknown>(params.value);

  React.useImperativeHandle(ref, () => ({
    getValue: () => parsedRef.current,
  }));

  const handleApply = () => {
    try {
      parsedRef.current = JSON.parse(text);
      setError(null);
      setOpen(false);
      params.stopEditing();
    } catch {
      setError("Invalid JSON");
    }
  };

  const handleCancel = () => {
    parsedRef.current = params.value;
    setOpen(false);
    params.stopEditing(true);
  };

  const columnName = String(params.colDef?.headerName ?? "JSON");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCancel();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {columnName}</DialogTitle>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          rows={10}
          className={[
            "w-full resize-y rounded-md border bg-background p-3 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "max-h-[80vh]",
            error ? "border-destructive" : "border-input",
          ].join(" ")}
          aria-label={`Edit ${columnName} as JSON`}
          spellCheck={false}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

JsonCellEditor.displayName = "JsonCellEditor";
