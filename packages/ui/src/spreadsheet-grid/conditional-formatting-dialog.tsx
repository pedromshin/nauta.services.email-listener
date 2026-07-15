"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import type {
  FormatColor,
  FormatCondition,
  FormatRule,
  FormattingRules,
} from "./types";
import { Button } from "../button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { Input } from "../input";
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

const CONDITION_LABELS: Record<FormatCondition, string> = {
  greater_than: "Greater than",
  less_than: "Less than",
  equals: "Equals",
  not_equals: "Not equals",
  contains: "Contains",
  not_contains: "Does not contain",
  not_empty: "Is not empty",
  is_empty: "Is empty",
};

const ALL_CONDITIONS: FormatCondition[] = [
  "greater_than",
  "less_than",
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "not_empty",
  "is_empty",
];

/** Conditions that do not require a value input */
const VALUE_LESS_CONDITIONS: ReadonlySet<FormatCondition> = new Set([
  "not_empty",
  "is_empty",
]);

const ALL_COLORS: FormatColor[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
];

/** CSS variable name for a given chart color */
function colorVar(color: FormatColor): string {
  return `color-mix(in srgb, var(--${color}) 70%, transparent)`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConditionalFormattingDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly columnName: string;
  readonly rules: readonly FormatRule[];
  readonly onSave: (columnName: string, rules: readonly FormatRule[]) => void;
}

// ---------------------------------------------------------------------------
// Color swatch picker
// ---------------------------------------------------------------------------

interface ColorPickerProps {
  readonly value: FormatColor;
  readonly onChange: (color: FormatColor) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-1">
      {ALL_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="h-5 w-5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            background: colorVar(color),
            boxShadow:
              value === color
                ? `0 0 0 2px var(--background), 0 0 0 3px var(--${color})`
                : undefined,
          }}
          aria-label={`Color ${color}`}
          aria-pressed={value === color}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule row
// ---------------------------------------------------------------------------

interface RuleRowProps {
  readonly rule: FormatRule;
  readonly onUpdate: (updated: FormatRule) => void;
  readonly onDelete: () => void;
}

function RuleRow({ rule, onUpdate, onDelete }: RuleRowProps) {
  const needsValue = !VALUE_LESS_CONDITIONS.has(rule.condition);

  const handleConditionChange = (condition: string) => {
    const newCondition = condition as FormatCondition;
    const needsValueAfter = !VALUE_LESS_CONDITIONS.has(newCondition);
    onUpdate({
      ...rule,
      condition: newCondition,
      value: needsValueAfter ? (rule.value ?? "") : null,
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...rule, value: e.target.value });
  };

  const handleColorChange = (color: FormatColor) => {
    onUpdate({ ...rule, color });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Condition select */}
      <Select value={rule.condition} onValueChange={handleConditionChange}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_CONDITIONS.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">
              {CONDITION_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input — hidden for valueless conditions */}
      <div className="w-28">
        {needsValue ? (
          <Input
            className="h-8 text-xs"
            placeholder="Value"
            value={String(rule.value ?? "")}
            onChange={handleValueChange}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Color picker */}
      <div className="flex-1">
        <ColorPicker value={rule.color} onChange={handleColorChange} />
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label="Delete rule"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog component
// ---------------------------------------------------------------------------

/** Generate a simple unique ID for new rules */
function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ConditionalFormattingDialog({
  open,
  onOpenChange,
  columnName,
  rules,
  onSave,
}: ConditionalFormattingDialogProps) {
  // Local copy of rules edited until Save is clicked
  // Track previous open state to reset when dialog opens
  const [prevOpen, setPrevOpen] = useState(open);
  const [localRules, setLocalRules] = useState<readonly FormatRule[]>(rules);
  if (open && !prevOpen) {
    setLocalRules(rules);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const handleAddRule = () => {
    const newRule: FormatRule = {
      id: generateRuleId(),
      condition: "not_empty",
      value: null,
      color: "chart-1",
    };
    setLocalRules((prev) => [...prev, newRule]);
  };

  const handleUpdateRule = (index: number, updated: FormatRule) => {
    setLocalRules((prev) =>
      prev.map((r, i): FormatRule => (i === index ? updated : r)),
    );
  };

  const handleDeleteRule = (index: number) => {
    setLocalRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(columnName, localRules);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalRules(rules); // discard local changes
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px] max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Conditional formatting &mdash; {columnName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Column headers */}
          {localRules.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="w-40">Condition</span>
              <span className="w-28">Value</span>
              <span className="flex-1">Color</span>
              <span className="w-8" />
            </div>
          )}

          {/* Rule list */}
          {localRules.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No rules yet. Click &ldquo;Add rule&rdquo; to create one.
            </p>
          )}
          {localRules.map((rule, index) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onUpdate={(updated) => handleUpdateRule(index, updated)}
              onDelete={() => handleDeleteRule(index)}
            />
          ))}

          {/* Add rule */}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 self-start"
            onClick={handleAddRule}
          >
            Add rule
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export types used by consumers
export type { FormatColor, FormatCondition, FormatRule, FormattingRules };
