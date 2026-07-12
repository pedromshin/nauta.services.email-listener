"use client";

// Explicit React import — Next.js's SWC automatic JSX runtime tolerates its
// absence, but vitest's classic-runtime esbuild JSX transform needs `React`
// in scope for any suite that mounts this file directly (documented gotcha,
// see genui-panel-node.tsx / 53-03 / 53-04's identical fix).
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@polytoken/ui/popover";

import { api } from "~/trpc/react";

import { CostBreakdownPopover } from "./cost-breakdown-popover";

export interface CostMeterProps {
  readonly conversationId: string;
}

/**
 * CostMeter (D-23, STREAM-03) — subtle toolbar text "Session: $0.12"
 * (text-xs text-muted-foreground), clickable to open a non-modal
 * CostBreakdownPopover. Purely a display: this component has no code path
 * that disables or blocks the composer/send — enforcement of any cap is
 * entirely server-side (22-04's cost breaker).
 */
export function CostMeter({
  conversationId,
}: CostMeterProps): React.ReactElement {
  const { data } = api.chat.sessionCost.useQuery({ conversationId });
  const total = data?.totalCostUsd ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-sm px-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {`Session: $${total.toFixed(2)}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <CostBreakdownPopover breakdown={data?.breakdown ?? []} />
      </PopoverContent>
    </Popover>
  );
}
