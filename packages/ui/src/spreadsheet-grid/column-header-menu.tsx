"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Input } from "../input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<SchemaFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Boolean",
  url: "URL",
  email: "Email",
  enum: "Enum",
  json: "JSON",
  array: "Array",
};

const ALL_FIELD_TYPES: SchemaFieldType[] = [
  "text",
  "number",
  "date",
  "boolean",
  "url",
  "email",
  "enum",
  "json",
  "array",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnHeaderMenuProps {
  readonly columnName: string;
  readonly columnType: SchemaFieldType;
  readonly isEditable: boolean;
  /** Children element that triggers the menu (rendered as the trigger) */
  readonly children: React.ReactNode;
  /** Controlled open state — if provided, parent manages open/close */
  readonly open?: boolean;
  /** Controlled open change handler */
  readonly onOpenChange?: (open: boolean) => void;
  readonly onRename: (oldName: string, newName: string) => void;
  readonly onChangeType: (name: string, newType: SchemaFieldType) => void;
  readonly onHide: (name: string) => void;
  readonly onDelete: (name: string) => void;
  readonly onFreeze: (name: string) => void;
  /** Called when user selects "Conditional formatting" from the menu (D-15) */
  readonly onConditionalFormatting?: (columnName: string) => void;
}

// ---------------------------------------------------------------------------
// Rename inline state
// ---------------------------------------------------------------------------

interface RenameDialogProps {
  readonly open: boolean;
  readonly columnName: string;
  readonly onConfirm: (newName: string) => void;
  readonly onCancel: () => void;
}

function RenameDialog({
  open,
  columnName,
  onConfirm,
  onCancel,
}: RenameDialogProps) {
  const [value, setValue] = useState(columnName);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== columnName) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename column</DialogTitle>
          <DialogDescription>
            Enter a new name for the &quot;{columnName}&quot; column.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          placeholder="Column name"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!value.trim() || value.trim() === columnName}
          >
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteConfirmDialogProps {
  readonly open: boolean;
  readonly columnName: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function DeleteConfirmDialog({
  open,
  columnName,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete column {columnName}?</DialogTitle>
          <DialogDescription>
            This will remove the column and delete all values in it. This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ColumnHeaderMenu({
  columnName,
  columnType,
  isEditable,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onRename,
  onChangeType,
  onHide,
  onDelete,
  onFreeze,
  onConditionalFormatting,
}: ColumnHeaderMenuProps) {
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled open state
  const menuOpen = controlledOpen ?? internalOpen;
  const setMenuOpen = (value: boolean) => {
    setInternalOpen(value);
    controlledOnOpenChange?.(value);
  };

  const handleRenameConfirm = (newName: string) => {
    setShowRename(false);
    onRename(columnName, newName);
  };

  const handleDeleteConfirm = () => {
    setShowDelete(false);
    onDelete(columnName);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {isEditable && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setShowRename(true);
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span>Change type</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-40">
                  {ALL_FIELD_TYPES.map((fieldType) => (
                    <DropdownMenuItem
                      key={fieldType}
                      onClick={() => onChangeType(columnName, fieldType)}
                    >
                      {FIELD_TYPE_LABELS[fieldType]}
                      {fieldType === columnType && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={() => onHide(columnName)}>
            Hide column
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onFreeze(columnName)}>
            Freeze column
          </DropdownMenuItem>
          {onConditionalFormatting && (
            <DropdownMenuItem
              onClick={() => {
                setMenuOpen(false);
                onConditionalFormatting(columnName);
              }}
            >
              Conditional formatting
            </DropdownMenuItem>
          )}

          {isEditable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  setMenuOpen(false);
                  setShowDelete(true);
                }}
              >
                Delete column
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog — rendered outside menu to avoid portal conflicts */}
      <RenameDialog
        open={showRename}
        columnName={columnName}
        onConfirm={handleRenameConfirm}
        onCancel={() => setShowRename(false)}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={showDelete}
        columnName={columnName}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}
