"use client";

// Explicit React import — Next.js's SWC automatic JSX runtime tolerates its
// absence, but vitest's classic-runtime esbuild JSX transform needs `React`
// in scope for any suite that mounts this file directly (documented gotcha,
// see genui-panel-node.tsx / 53-03 / 53-04's identical fix).
import * as React from "react";
import { useMemo } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@polytoken/ui/command";

import { api } from "~/trpc/react";

import { useDeviceModelRecommendation } from "../_hooks/use-device-model-recommendation";
import {
  ModelPickerEntry,
  type ChatModelEntry,
  type WebllmEntryState,
} from "./model-picker-entry";

export interface ModelPickerPanelProps {
  readonly conversationId: string;
  readonly currentModelId: string;
  /** See ModelPicker's prop of the same name — the 22-11 browser-locus
   * download/WebGPU-readiness gate. Awaited before persisting; a rejection
   * aborts the selection with the panel left open. */
  readonly onSelectBrowserModel?: (modelId: string) => Promise<void>;
  /** Visual state for the browser-locus rows (D-08) — omit to render them
   * like any other entry. */
  readonly webllm?: WebllmEntryState;
  /** Called when a selection settles and the hosting surface (the header's
   * Popover, or the quick-actions FAB's Dialog) should close. */
  readonly onClose: () => void;
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
 * ModelPickerPanel — the cmdk Command body of the model picker (D-04..D-10),
 * extracted from ModelPicker so BOTH hosts consume one implementation:
 * ModelPicker's header PopoverContent (unchanged behavior) and the
 * quick-actions FAB's Dialog (chat-quick-actions-fab.tsx). Selecting a
 * server model persists via chat.setModel and invalidates listConversations
 * (so the page's selectedConversation.modelId — which feeds
 * useChatStream.send — updates); selecting a browser model defers to
 * onSelectBrowserModel first (22-11 seam).
 */
export function ModelPickerPanel({
  conversationId,
  currentModelId,
  onSelectBrowserModel,
  webllm,
  onClose,
}: ModelPickerPanelProps): React.ReactElement {
  const utils = api.useUtils();
  const { data } = api.chat.models.useQuery();
  const setModel = api.chat.setModel.useMutation({
    onSuccess: async () => {
      await utils.chat.listConversations.invalidate();
    },
  });

  const models = data?.models ?? [];

  // DX Phase 0 — device-profiled local-model hint. Profiles the visitor's
  // hardware and recommends the best browser-locus model it can run; badges
  // that row only. Suggestion-only: it never changes the selected model.
  const browserModelIds = useMemo(
    () =>
      models
        .filter((model) => model.executionLocus === "browser")
        .map((model) => model.id),
    [models],
  );
  const recommendedForDeviceId = useDeviceModelRecommendation(browserModelIds);

  const handleSelect = async (model: ChatModelEntry): Promise<void> => {
    if (model.executionLocus === "browser") {
      if (webllm && !webllm.supported) return; // disabled row — defensive no-op
      if (onSelectBrowserModel) {
        try {
          await onSelectBrowserModel(model.id);
        } catch {
          // Loading failed (e.g. WebGPU OOM) — leave the panel open; the
          // row's own error state surfaces via webllm.status, nothing persists.
          return;
        }
      }
      if (model.id !== currentModelId) {
        setModel.mutate({ conversationId, modelId: model.id });
      }
      onClose();
      return;
    }
    onClose();
    if (model.id === currentModelId) return;
    setModel.mutate({ conversationId, modelId: model.id });
  };

  return (
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
                    isRecommendedForDevice={
                      model.id === recommendedForDeviceId
                    }
                    webllm={
                      model.executionLocus === "browser" ? webllm : undefined
                    }
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </Command>
  );
}
