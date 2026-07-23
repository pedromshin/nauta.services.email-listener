"use client";

// Explicit React import — Next.js's SWC automatic JSX runtime tolerates its
// absence, but vitest's classic-runtime esbuild JSX transform needs `React`
// in scope for any suite that mounts this file directly (documented gotcha,
// see genui-panel-node.tsx / 53-03 / 53-04's identical fix).
import * as React from "react";
import { useMemo, useState } from "react";

import { Button } from "@polytoken/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@polytoken/ui/popover";

import { api } from "~/trpc/react";

import { ModelPickerPanel } from "./model-picker-panel";
import { type WebllmEntryState } from "./model-picker-entry";

export interface ModelPickerProps {
  readonly conversationId: string;
  readonly currentModelId: string;
  /**
   * Called BEFORE persisting a browser-locus (WebLLM) selection — 22-11's
   * download/WebGPU-readiness gate (the caller's implementation calls
   * useWebllmEngine().ensureLoaded()). The panel awaits it, then persists
   * via the SAME chat.setModel path as any other model — this keeps the
   * "same API, same shape" selection flow uniform across loci. Rejecting
   * (loading failed) aborts the selection: the picker stays open, nothing
   * persists, and the row's own `webllm.status === 'error'` surfaces the
   * failure. Falls back to persisting immediately (no loading gate) when
   * omitted.
   */
  readonly onSelectBrowserModel?: (modelId: string) => Promise<void>;
  /** Visual state for the browser-locus row (D-08) — omit to render it like
   * any other entry (pre-22-11 fallback). */
  readonly webllm?: WebllmEntryState;
}

/**
 * ModelPicker (D-04..D-10) — toolbar trigger showing the current model's
 * short name; opens the shared ModelPickerPanel (cmdk Command grouped
 * Bedrock / OpenRouter / Browser, 22-UI-SPEC.md Interaction Contracts) in a
 * Popover. The Command body + selection/persistence logic lives in
 * model-picker-panel.tsx so the quick-actions FAB's Dialog host consumes the
 * exact same panel — this component is now only the header trigger + Popover
 * shell (behavior unchanged).
 */
export function ModelPicker({
  conversationId,
  currentModelId,
  onSelectBrowserModel,
  webllm,
}: ModelPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { data } = api.chat.models.useQuery();

  const models = data?.models ?? [];

  const currentModel = useMemo(
    () => models.find((model) => model.id === currentModelId) ?? null,
    [models, currentModelId],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-w-48 justify-start truncate"
        >
          {currentModel?.displayName ?? currentModelId}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[26rem] p-0 data-[state=open]:animate-none data-[state=closed]:animate-none"
      >
        <div className="t-dropdown-reveal">
          <ModelPickerPanel
            conversationId={conversationId}
            currentModelId={currentModelId}
            onSelectBrowserModel={onSelectBrowserModel}
            webllm={webllm}
            onClose={() => setOpen(false)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
