"use client";

import { useMemo, useState } from "react";

import { Button } from "@nauta/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@nauta/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@nauta/ui/popover";

import { api } from "~/trpc/react";

import {
  ModelPickerEntry,
  type ChatModelEntry,
  type WebllmEntryState,
} from "./model-picker-entry";

export interface ModelPickerProps {
  readonly conversationId: string;
  readonly currentModelId: string;
  /**
   * Called BEFORE persisting a browser-locus (WebLLM) selection — 22-11's
   * download/WebGPU-readiness gate (the caller's implementation calls
   * useWebllmEngine().ensureLoaded()). ModelPicker awaits it, then persists
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

const TRANSPORT_GROUPS: ReadonlyArray<{
  readonly transport: ChatModelEntry["transport"];
  readonly heading: string;
}> = [
  { transport: "bedrock", heading: "Bedrock" },
  { transport: "openrouter", heading: "OpenRouter" },
  { transport: "browser", heading: "Browser" },
];

/**
 * ModelPicker (D-04..D-10) — toolbar trigger showing the current model's
 * short name; opens a cmdk Command grouped Bedrock / OpenRouter / Browser
 * (22-UI-SPEC.md Interaction Contracts). Selecting a server model persists
 * it via chat.setModel and invalidates listConversations (so the parent's
 * selectedConversation.modelId — which feeds useChatStream.send — updates);
 * selecting a browser model defers to onSelectBrowserModel (22-11 seam).
 */
export function ModelPicker({
  conversationId,
  currentModelId,
  onSelectBrowserModel,
  webllm,
}: ModelPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const { data } = api.chat.models.useQuery();
  const setModel = api.chat.setModel.useMutation({
    onSuccess: async () => {
      await utils.chat.listConversations.invalidate();
    },
  });

  const models = data?.models ?? [];

  const currentModel = useMemo(
    () => models.find((model) => model.id === currentModelId) ?? null,
    [models, currentModelId],
  );

  const handleSelect = async (model: ChatModelEntry): Promise<void> => {
    if (model.executionLocus === "browser") {
      if (webllm && !webllm.supported) return; // disabled row — defensive no-op
      if (onSelectBrowserModel) {
        try {
          await onSelectBrowserModel(model.id);
        } catch {
          // Loading failed (e.g. WebGPU OOM) — leave the picker open; the
          // row's own error state surfaces via webllm.status, nothing persists.
          return;
        }
      }
      if (model.id !== currentModelId) {
        setModel.mutate({ conversationId, modelId: model.id });
      }
      setOpen(false);
      return;
    }
    setOpen(false);
    if (model.id === currentModelId) return;
    setModel.mutate({ conversationId, modelId: model.id });
  };

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
          <Command>
            <CommandInput placeholder="Search models…" />
            <CommandList>
              <CommandEmpty>No models available.</CommandEmpty>
              {TRANSPORT_GROUPS.map(({ transport, heading }) => {
                const entries = models.filter(
                  (model) => model.transport === transport,
                );
                if (entries.length === 0) return null;
                return (
                  <CommandGroup key={transport} heading={heading}>
                    {entries.map((model) => (
                      <CommandItem
                        key={model.id}
                        value={`${model.displayName} ${model.id}`}
                        disabled={
                          model.executionLocus === "browser" &&
                          webllm !== undefined &&
                          !webllm.supported
                        }
                        onSelect={() => void handleSelect(model)}
                      >
                        <ModelPickerEntry
                          model={model}
                          isRecommended={model.id === currentModelId}
                          webllm={
                            model.executionLocus === "browser"
                              ? webllm
                              : undefined
                          }
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  );
}
