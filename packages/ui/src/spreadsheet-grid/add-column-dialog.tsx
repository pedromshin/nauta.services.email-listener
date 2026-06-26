"use client";

import { useState } from "react";

import type { SchemaFieldType } from "./types";
import { Button } from "../button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPE_OPTIONS: { value: SchemaFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "enum", label: "Enum" },
  { value: "json", label: "JSON" },
  { value: "array", label: "Array" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddColumnDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAdd: (name: string, type: SchemaFieldType) => void;
  readonly existingNames: readonly string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddColumnDialog({
  open,
  onOpenChange,
  onAdd,
  existingNames,
}: AddColumnDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SchemaFieldType>("text");

  const trimmedName = name.trim();
  const isDuplicate = existingNames.some(
    (n) => n.toLowerCase() === trimmedName.toLowerCase(),
  );
  const isNameValid = trimmedName.length > 0 && !isDuplicate;

  const handleAdd = () => {
    if (!isNameValid) return;
    onAdd(trimmedName, type);
    // Reset form
    setName("");
    setType("text");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setName("");
    setType("text");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isNameValid) handleAdd();
    if (e.key === "Escape") handleCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Column</DialogTitle>
          <DialogDescription>
            Add a new column to this data source schema.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Column name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-column-name">Column name</Label>
            <Input
              id="add-column-name"
              aria-label="Add column"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Column name"
              autoFocus
            />
            {isDuplicate && trimmedName.length > 0 && (
              <p className="text-xs text-destructive">
                A column named &quot;{trimmedName}&quot; already exists.
              </p>
            )}
          </div>

          {/* Column type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-column-type">Column type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as SchemaFieldType)}
            >
              <SelectTrigger id="add-column-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleAdd} disabled={!isNameValid}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
