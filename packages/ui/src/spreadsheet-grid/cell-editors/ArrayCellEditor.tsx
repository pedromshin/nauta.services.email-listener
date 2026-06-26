"use client";

import type { ICellEditorParams } from "ag-grid-community";
import * as React from "react";

import { Badge } from "../../badge";
import { Input } from "../../input";

/** Array cell editor with tag chip input (D-08) */
export const ArrayCellEditor = React.forwardRef<
  { getValue: () => string[] },
  ICellEditorParams
>((params, ref) => {
  const initial: string[] = (() => {
    if (!params.value) return [];
    if (Array.isArray(params.value)) return params.value.map(String);
    return [String(params.value)];
  })();

  const [items, setItems] = React.useState<string[]>(initial);
  const [inputValue, setInputValue] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useImperativeHandle(ref, () => ({
    getValue: () => items,
  }));

  const addItem = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) {
      setItems((prev) => [...prev, trimmed]);
    }
    setInputValue("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addItem(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && items.length > 0) {
      setItems((prev) => prev.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Split on comma typed
    if (val.endsWith(",")) {
      addItem(val.slice(0, -1));
    } else {
      setInputValue(val);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-wrap items-center gap-1 rounded-md border border-ring bg-background p-1">
      {items.map((item, idx) => (
        <Badge
          key={idx}
          variant="secondary"
          className="flex items-center gap-0.5 text-xs"
        >
          {item}
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${item}`}
          >
            ×
          </button>
        </Badge>
      ))}
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="h-6 min-w-[80px] flex-1 rounded-none border-0 p-0 text-sm shadow-none focus-visible:ring-0"
        placeholder="Add item..."
        aria-label={String(params.colDef?.headerName ?? "Array")}
      />
    </div>
  );
});

ArrayCellEditor.displayName = "ArrayCellEditor";
