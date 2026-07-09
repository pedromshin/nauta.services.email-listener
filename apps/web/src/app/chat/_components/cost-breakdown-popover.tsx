import type { RouterOutputs } from "@polytoken/api-client";

export type CostBreakdownRow =
  RouterOutputs["chat"]["sessionCost"]["breakdown"][number];

export interface CostBreakdownPopoverProps {
  readonly breakdown: readonly CostBreakdownRow[];
}

/**
 * CostBreakdownPopover (D-23) — per-turn rows (model, tokens in/out, cost)
 * rendered inside CostMeter's Popover. Read-only; renders whatever the
 * bounded sessionCost query returned, in the same order (oldest first).
 */
export function CostBreakdownPopover({
  breakdown,
}: CostBreakdownPopoverProps): React.ReactElement {
  if (breakdown.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No usage yet in this conversation.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Cost breakdown</p>
      <ul className="space-y-1.5">
        {breakdown.map((row, index) => (
          <li
            key={row.runId ?? index}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="truncate text-muted-foreground">
              {row.modelId}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {row.inputTokens}/{row.outputTokens} tok
            </span>
            <span className="shrink-0 font-semibold text-foreground">
              ${row.costUsd.toFixed(4)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
