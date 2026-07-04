"use client";

/**
 * use-webllm-engine.ts — in-browser WebLLM engine hook (D-08, D-09 locus seam).
 *
 * Detects WebGPU support (`navigator.gpu`) and lazily creates a MODULE-LEVEL
 * singleton `@mlc-ai/web-llm` MLCEngine ONLY when a caller actually selects
 * the browser model (`ensureLoaded()`) — the engine and its weights are never
 * touched at import time or first paint. Exposes `generateStream()`, which
 * mirrors useChatStream's growing-text contract closely enough that
 * ConversationView (page.tsx) can render both server and browser turns
 * through the SAME MessageList (text-only, D-08 — no genui tool is ever
 * offered to a browser-locus model).
 *
 * The `@mlc-ai/web-llm` import itself is dynamic (inside ensureLoaded()), so
 * the ~13MB package and its WASM/WebGPU runtime never enter the server
 * bundle or the initial client bundle — `next build` stays green even though
 * the library assumes a browser environment.
 *
 * Model id mapping (see 22-11-SUMMARY.md deviations): the curated FastAPI
 * registry (chat_model_registry.py) exposes this browser entry as
 * id="webllm-qwen3-4b" / display "Qwen3 4B (in-browser)". D-08 named
 * "Qwen3 4B or Gemma 3 4B" as equally acceptable curated options; the vetted
 * @mlc-ai/web-llm 0.2.84 package's prebuiltAppConfig ships no Gemma-3-4B
 * build (only Gemma3-1B), so this hook targets the real, available Qwen3-4B
 * prebuilt — the registry entry was renamed to match exactly what runs
 * (D-05/D-06 honesty contract: never advertise a model that isn't what's
 * actually loaded).
 *
 * The engine is a MODULE-LEVEL singleton (not per-hook-instance) so
 * navigating between conversations never re-downloads the (large,
 * first-run-only) model weights — a fresh hook instance's initial state
 * lazily reflects whatever the singleton already holds.
 */

import { useCallback, useEffect, useState } from "react";
import type {
  ChatCompletionMessageParam,
  MLCEngine,
} from "@mlc-ai/web-llm";

/** The curated FastAPI registry's id for this browser-locus entry (22-02,
 * repointed in 22-11 — see chat_model_registry.py). */
export const WEBLLM_REGISTRY_MODEL_ID = "webllm-qwen3-4b";

/** The actual @mlc-ai/web-llm prebuilt model id this hook loads. */
const WEBLLM_ENGINE_MODEL_ID = "Qwen3-4B-q4f16_1-MLC";

/** D-01 parity: same neutral persona the server-side agent uses
 * (run_chat_turn.py's _SYSTEM_PROMPT) — the browser model gets the same
 * behavior, just running locally. */
const SYSTEM_PROMPT =
  "You are a helpful, neutral AI assistant. Respond clearly and concisely to the user's requests.";

export type WebllmStatus = "idle" | "loading" | "ready" | "error";

export interface WebllmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface WebllmStreamChunk {
  readonly textDelta: string;
  /** Present only on the final chunk (stream_options.include_usage). */
  readonly usage?: WebllmUsage;
}

export interface WebllmChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface UseWebllmEngineResult {
  /** WebGPU detected (navigator.gpu present) — false disables the picker
   * entry (22-UI-SPEC.md "Your browser doesn't support WebGPU…"). */
  readonly supported: boolean;
  readonly status: WebllmStatus;
  /** 0-100 — feeds the @nauta/ui Progress component directly. */
  readonly progress: number;
  /** UI-SPEC ordered label states ("Downloading model…" -> "Loading into
   * WebGPU…"); empty until the first progress report arrives. */
  readonly progressText: string;
  /** Idempotent — resolves immediately if the singleton is already
   * loaded/loading. Throws if WebGPU is unsupported. */
  readonly ensureLoaded: () => Promise<void>;
  /** Text-only local streaming (D-08 — no tools, no genui). Throws if the
   * engine has not been loaded yet. */
  readonly generateStream: (
    messages: readonly WebllmChatMessage[],
  ) => AsyncGenerator<WebllmStreamChunk, void, void>;
  /** Best-effort interrupt for the composer's Stop button (CHAT-03 parity
   * with the server-locus stop path) — fire-and-forget. */
  readonly interrupt: () => void;
}

// Module-level singleton — survives across hook instances/unmounts so
// switching conversations never re-downloads the model weights.
let engineSingleton: MLCEngine | null = null;
let loadPromise: Promise<MLCEngine> | null = null;

function detectWebGpuSupport(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator && navigator.gpu !== undefined;
}

// Maps @mlc-ai/web-llm's raw InitProgressReport.text into the UI-SPEC's
// ordered copy states (22-UI-SPEC.md Copywriting Contract).
function progressTextFor(rawText: string): string {
  if (
    rawText.includes("GPU shader") ||
    rawText.includes("Loading model from cache")
  ) {
    return "Loading into WebGPU…";
  }
  return "Downloading model… (~2.5GB, first run only)";
}

export function useWebllmEngine(): UseWebllmEngineResult {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<WebllmStatus>(
    engineSingleton ? "ready" : "idle",
  );
  const [progress, setProgress] = useState<number>(
    engineSingleton ? 100 : 0,
  );
  const [progressText, setProgressText] = useState<string>("");

  // WebGPU detection is client-only (navigator is undefined during SSR) —
  // deferred to an effect rather than read at render time.
  useEffect(() => {
    setSupported(detectWebGpuSupport());
  }, []);

  const ensureLoaded = useCallback(async (): Promise<void> => {
    if (engineSingleton) {
      setStatus("ready");
      setProgress(100);
      return;
    }
    if (!detectWebGpuSupport()) {
      throw new Error("WebGPU is not supported in this browser");
    }

    setStatus("loading");
    setProgress(0);
    setProgressText("");

    if (!loadPromise) {
      loadPromise = (async () => {
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        return CreateMLCEngine(WEBLLM_ENGINE_MODEL_ID, {
          initProgressCallback: (report) => {
            setProgress(Math.round(report.progress * 100));
            setProgressText(progressTextFor(report.text));
          },
        });
      })();
    }

    try {
      engineSingleton = await loadPromise;
      setStatus("ready");
      setProgress(100);
    } catch (error) {
      loadPromise = null;
      setStatus("error");
      throw error;
    }
  }, []);

  const generateStream = useCallback(async function* (
    messages: readonly WebllmChatMessage[],
  ): AsyncGenerator<WebllmStreamChunk, void, void> {
    if (!engineSingleton) {
      throw new Error(
        "WebLLM engine is not loaded — call ensureLoaded() first",
      );
    }

    const chatMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const stream = await engineSingleton.chat.completions.create({
      messages: chatMessages,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const textDelta = chunk.choices[0]?.delta.content ?? "";
      const usage = chunk.usage
        ? {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          }
        : undefined;
      if (textDelta || usage) {
        yield { textDelta, usage };
      }
    }
  }, []);

  const interrupt = useCallback((): void => {
    void engineSingleton?.interruptGenerate();
  }, []);

  return {
    supported,
    status,
    progress,
    progressText,
    ensureLoaded,
    generateStream,
    interrupt,
  };
}
