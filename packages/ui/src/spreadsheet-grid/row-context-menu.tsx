"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RowContextMenuProps {
  readonly rowId: string;
  readonly position: { readonly x: number; readonly y: number };
  /** Changing this key re-opens the menu — set to `${rowId}-${Date.now()}` */
  readonly triggerKey: string;
  readonly onAddRow?: () => void;
  readonly onDeleteRow?: (rowId: string) => void;
  readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Radix-based row context menu rendered at a fixed screen position.
 *
 * Follows the same pattern as ColumnHeaderMenu: a hidden zero-size trigger
 * is positioned at the right-click coordinates, and the menu is opened
 * programmatically via `open={true}`.
 *
 * If neither `onAddRow` nor `onDeleteRow` is provided (read-only mode) this
 * component renders nothing.
 */
export function RowContextMenu({
  rowId,
  position,
  onAddRow,
  onDeleteRow,
  onClose,
}: RowContextMenuProps) {
  // In read-only mode there is nothing to show.
  if (!onAddRow && !onDeleteRow) {
    return null;
  }

  const handleAddRow = () => {
    onAddRow?.();
    onClose();
  };

  const handleDeleteRow = () => {
    onDeleteRow?.(rowId);
    onClose();
  };

  return (
    <DropdownMenu
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Hidden zero-size trigger anchored at cursor position */}
      <DropdownMenuTrigger asChild>
        <span
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-40">
        {onAddRow && (
          <DropdownMenuItem onClick={handleAddRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </DropdownMenuItem>
        )}

        {onAddRow && onDeleteRow && <DropdownMenuSeparator />}

        {onDeleteRow && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleDeleteRow}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Row
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
