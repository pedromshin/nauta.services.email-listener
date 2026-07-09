"use client";

/**
 * add-knowledge-preview-popover.tsx — AddKnowledgePreviewPopover: the
 * toolbar creation affordance for a `knowledge-preview` canvas node
 * (PREV-01, 41-UI-SPEC.md section 6).
 *
 * Manual paste-an-ID only (41-CONTEXT.md's explicit discretion resolution —
 * no search/picker UI). `z.string().uuid().safeParse` gates `onAdd`
 * (T-41-07): an invalid/empty value never calls `onAdd`, never creates a
 * node, never fires `expandNode` — the popover stays open with inline error
 * copy instead. Controlled `open` state (unlike edge-creation-picker.tsx's
 * always-open anchored popover) so a successful add can close itself
 * programmatically.
 */

import * as React from "react";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@polytoken/ui/button";
import { Input } from "@polytoken/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@polytoken/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@polytoken/ui/tooltip";

const NODE_ID_SCHEMA = z.string().uuid();

export interface AddKnowledgePreviewPopoverProps {
  readonly onAdd: (focusNodeId: string, label: string | undefined) => void;
}

export function AddKnowledgePreviewPopover({
  onAdd,
}: AddKnowledgePreviewPopoverProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [nodeIdInput, setNodeIdInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function resetForm(): void {
    setNodeIdInput("");
    setLabelInput("");
    setValidationError(null);
  }

  function handleAddClick(): void {
    const result = NODE_ID_SCHEMA.safeParse(nodeIdInput.trim());
    if (!result.success) {
      setValidationError("Enter a valid knowledge node ID.");
      return; // keeps the popover open — onAdd never called on an invalid id
    }
    onAdd(result.data, labelInput.trim() || undefined);
    resetForm();
    setOpen(false);
  }

  function handleCancel(): void {
    resetForm();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Add knowledge preview"
                className="size-11 bg-background/70 backdrop-blur-md"
              >
                <Share2 className="size-4" aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Add knowledge preview</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-sm font-normal text-foreground">Add knowledge preview</p>
        <div className="space-y-1">
          <label htmlFor="kp-node-id" className="text-xs text-muted-foreground">
            Knowledge node ID
          </label>
          <Input
            id="kp-node-id"
            placeholder="Paste a node ID…"
            value={nodeIdInput}
            onChange={(event) => setNodeIdInput(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Find an ID on the /knowledge graph, or paste one from a chat citation chip.
          </p>
          {validationError && <p className="text-xs text-destructive">{validationError}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="kp-label" className="text-xs text-muted-foreground">
            Label (optional)
          </label>
          <Input
            id="kp-label"
            placeholder="Custom name for this preview"
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!nodeIdInput.trim()}
            onClick={handleAddClick}
          >
            Add preview
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
