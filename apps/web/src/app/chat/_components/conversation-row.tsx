"use client";

import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { cn } from "@nauta/ui";
import { Button } from "@nauta/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nauta/ui/dropdown-menu";

export interface ConversationSummary {
  readonly id: string;
  readonly title: string;
  readonly modelId: string;
  readonly updatedAt: string | Date;
}

interface ConversationRowProps {
  readonly conversation: ConversationSummary;
  readonly isActive: boolean;
  readonly onSelect: (id: string) => void;
  readonly onRequestRename: (id: string) => void;
  readonly onRequestDelete: (id: string) => void;
}

/**
 * ConversationRow (D-11 rail row) — title snippet (truncate) + relative
 * timestamp + an always-rendered `MoreHorizontal` overflow menu (never
 * hover-only, per the UI-SPEC accessibility section — keyboard/touch users
 * need a persistent affordance). Active row gets the shared
 * `bg-primary/10 text-primary` treatment (D-20 continuity with AppSidebar).
 *
 * Rename/Delete menu items call back up to the rail, which (from Task 3)
 * opens InlineRenameField / DeleteConversationDialog.
 */
export function ConversationRow({
  conversation,
  isActive,
  onSelect,
  onRequestRename,
  onRequestDelete,
}: ConversationRowProps): React.ReactElement {
  const updatedAt =
    conversation.updatedAt instanceof Date
      ? conversation.updatedAt
      : new Date(conversation.updatedAt);

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 py-1",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="flex min-w-0 flex-1 flex-col items-start px-1 py-1 text-left"
      >
        <span className="w-full truncate text-sm">{conversation.title}</span>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(updatedAt, { addSuffix: true })}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${conversation.title}`}
            className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onRequestRename(conversation.id)}>
            <Pencil className="mr-2 size-4" aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onRequestDelete(conversation.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
