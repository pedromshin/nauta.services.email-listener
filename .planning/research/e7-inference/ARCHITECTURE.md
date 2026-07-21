# ARCHITECTURE — E7: Distributed Inference / Compute Pooling

> **Status:** DESIGN doc, implementation-ready — the INPUT to `/gsd:new-milestone` for the E7 epoch.
> When the epoch opens, point `/gsd:new-milestone` at this file; §7's phase breakdown is written in
> ROADMAP.md house style so it lifts directly.
> **Researched:** 2026-07-20. The inference-runtime landscape churns monthly — every framework claim
> below carries a live 2026 source; re-verify version pins at phase-planning time (same practice note
> the Cloud Desktop RFC §0 and frontier §C apply to fast-moving spaces).
> **What this is:** the realization of VISION E7 — "idle machines offer compute; others offload to
> the pool; scheduler matches task profile to node profile" [VISION §E7]. Reframed per guardrail 2:
> an inference request is a **daemon-protocol-shaped JOB**, and local / pooled / hosted are just
> **different provider bindings** behind one port [VISION §3 guardrail 2].
> **What this is NOT:** another hosted-API adapter. Polytoken already has Bedrock + OpenRouter chat
> transports and a WebLLM browser model in its registry — E7 is about **LOCAL** and **POOLED**
> inference (the user's own hardware and the user's own fleet), with hosted as the fallback floor.

---

## 0. The seam already exists — E7 is a POPULATE, not a re-architecture

Two substrate seams were deliberately built ahead of this epoch. E7 fills them:

1. **The chat model registry already carries the distributed-inference axis.** Both the TS boundary
   (`packages/api-client/src/router/chat/models.ts`) and the Python domain registry
   (`apps/email-listener/app/domain/services/chat_model_registry.py`) declare:
   - `transport: "bedrock" | "openrouter" | "browser"`
   - `execution_locus: "server" | "browser" | "remote-peer"` — and the Python registry's own comment
     says **`'remote-peer' reserved, unused today`** (D-09's "sovereign/distributed-inference seam").
   E7 activates `remote-peer` and adds a `daemon-local` locus. The picker, pricing, capability flags,
   and the `$0` local-inference convention (D-08) are already in place.

2. **The capability substrate is the job envelope.** `packages/capabilities/src/capability.ts`
   (`defineCapability` + `Capability` with `id/input/output/risk/reversibility/cost/scope/execute`)
   plus the `DesktopProvider`-port pattern in `packages/capabilities/src/desktop.ts` are the exact
   shape E7 reuses. A cloud desktop is "the third proof of guardrail 2" [desktop.ts header]; an
   inference job is the **fourth**. `inference.run` is a `defineCapability()` descriptor with an
   injected `InferenceProvider` port — local/pooled/hosted are provider implementations, identical to
   how `desktop.ts` injects `DesktopProvider` and binds Hetzner in the control plane.

**Consequence:** do not invent a parallel inference framework. Extend the registry's locus axis,
add one capability + one port, and bind providers. The design below is deliberately small at the
substrate layer and pushes all churn-prone runtime detail behind the port.

---

## 1. The tier model — reason about a model CLASS, never a model id (Q6)

Per NEG Q6 / VISION Q6, polytoken reasons about a **model class**; the router resolves class → a
concrete provider binding at request time. Five tiers, ordered cheapest-and-most-private first:

| Tier | `execution_locus` | Model class (example) | Data locality | Cost | 2026 primary framework |
|---|---|---|---|---|---|
| **A. In-browser / on-device** | `browser` | `on-device-small` | Never leaves the browser | $0 | **Chrome Prompt API (Gemini Nano)** → **WebLLM** fallback; **transformers.js v4** for utility |
| **B. Local machine (daemon)** | `daemon-local` *(new)* | `local-mid`, `local-large` | Never leaves the user's machine | $0 (electricity) | **Ollama** (default) behind the port; llama.cpp / MLX / vLLM as alternate bindings |
| **C. Pooled / distributed** | `remote-peer` *(reserved→active)* | `pooled-frontier` | Stays within user-owned nodes | $0 (own fleet) / credits | **Job-routing to least-loaded daemon** (default); **exo** / **Parallax** as sharding bindings |
| **D. Hosted fallback** | `server` | `hosted-frontier` | Leaves to provider | $ metered | Existing **Bedrock** + **OpenRouter** (DeepSeek V4, GLM, Qwen) |

The router walks the ladder **A → D** and resolves the *cheapest tier that satisfies the request's
class + capability requirements*, falling **down** the ladder (toward hosted) when a preferred tier
is unavailable, and never silently **up** in data-exposure without the class permitting it. Privacy
is a first-class routing input, not an afterthought (§5).

### 1.A — In-browser / on-device (zero-cost, private, no server round-trip)

The browser is a legitimate inference runtime in 2026, not an experiment:

- **Chrome built-in AI / Prompt API (Gemini Nano) — PRIMARY when available.** As of **Chrome 148 the
  Prompt API is stable and exposed to web pages** (previously extension-only through Chrome 138),
  alongside Summarizer / Translator / Language Detector. `window.ai` streams from a ~4 GB on-device
  model; **no data leaves the device**. Gating to respect: needs a production **Origin Trial token**
  (or extension distribution), and requires ≥22 GB free disk + 16 GB RAM or ≥4 GB VRAM, Chrome only
  [developer.chrome.com/docs/ai; pasqualepillitteri.it Chrome 148]. Treat as **progressive
  enhancement**: feature-detect `window.ai`, use it when present, fall through otherwise.
- **WebLLM (MLC) — PORTABLE fallback.** WebGPU, cross-browser, and **already vetted in polytoken's
  registry** (`webllm-qwen3-4b`, `@mlc-ai/web-llm 0.2.84`). This is the honest default for
  chat-class on-device work where Chrome's API isn't available [chat_model_registry.py:138].
- **transformers.js v4 — UTILITY tier.** HF's **complete WebGPU runtime rewrite (Feb 2026)**, "from
  promising experiment to production-ready," ~4× faster, 500+ models, 53% smaller bundles. Best for
  **high-frequency low-complexity** tasks: embeddings, classification, short-text summarization —
  exactly the tasks that should never hit a server [roboaidigest transformers.js v4;
  ucstrategies transformers.js v4].
- **Ternary "Bonsai" (PrismML) — the ceiling of the browser tier.** The 2026 wave the user flagged:
  **Ternary Bonsai** is a 1.58-bit ({−1,0,1}) family (1.7B/4B/8B) plus **Bonsai 27B**, which runs
  **27B-class reasoning on a phone at ~4 GB via WebGPU** (July 2026), **distributed as GGUF**
  [progressiverobot Ternary Bonsai; essamamdani Bonsai 27B; huggingface prism-ml/Ternary-Bonsai-27B-gguf].
  Watch as a candidate `on-device-small` upgrade; do not pin as a dependency yet (weeks-old).

**Pick:** `on-device-small` class = Chrome Prompt API (feature-detected) → WebLLM (portable) →
transformers.js v4 (utility/embeddings). The browser tier is the private-by-construction floor.

### 1.B — Local machine via the daemon (the user's own GPU)

The 2026 consensus is stable and boring in the good way [Red Hat Developer llamacpp-vs-vllm 2026-06-15;
contracollective Apple-Silicon 2026; codersera 2026]:

- **Ollama — DEFAULT daemon binding.** Best ergonomics, automatic model management, one install, and
  an **OpenAI-compatible endpoint** (so the adapter is trivial). Under the hood it wraps **llama.cpp
  on x86 and MLX on Apple Silicon (since Ollama 0.19, March 2026)** — the user gets the right backend
  for their hardware for free. Weakness: sequential request handling (latency spikes under
  concurrency) — irrelevant for a single-user personal daemon, decisive against it for a shared
  server [codersera 2026; Red Hat 2026].
- **llama.cpp direct** — when fine-grained control / exotic hardware (Vulkan, ROCm, CPU-only) matters;
  it "wins on portability and control" and is the `ggml`/**GGUF** reference implementation.
- **MLX** — best raw performance on M-series Pro/Max/Ultra; already reachable *through* Ollama.
- **vLLM / SGLang** — the production-GPU-server answer (PagedAttention, sub-100 ms P99 at 128 concurrent
  users, 5,841 tok/s on an RTX 5090). Over-powered for one user; the right binding **only** for a
  user whose "local machine" is a real GPU box serving a household/team [Red Hat 2026; tensorfoundry].
- **NVIDIA stack (TensorRT-LLM / NIM / Dynamo)** — TensorRT-LLM is the fastest single-GPU path but
  compiles **hardware-specific engine files** (rebuild per GPU = lock-in); NIM is a single-container
  NVIDIA-only convenience; **Dynamo is datacenter-scale disaggregated serving** — explicitly *not*
  for a personal pool [spheron NVIDIA Dynamo 2026; NVIDIA/TensorRT-LLM disagg-serving]. Support them
  as **optional accelerator bindings** behind the port for NVIDIA power users; never the contract.
- **Weight format & quant:** **GGUF is the lingua franca**; **Unsloth Dynamic 2.0 GGUF** is the
  accuracy-preserving quant of record in 2026 — dynamic per-layer quantization, lower KL-divergence
  than standard k-quants/QAT, runs on any GGUF engine (llama.cpp/Ollama), ~46% faster on GPU/Apple
  [unsloth.ai/blog/dynamic-v2; modelslab Unsloth Dynamic 2.0]. Prefer GGUF + Unsloth Dynamic quants
  for anything the daemon ships.

**Pick:** `local-mid` / `local-large` class = **Ollama** as the default `InferenceProvider` binding
(OpenAI-compatible = ~1 adapter), with llama.cpp / MLX / vLLM / TensorRT-LLM as alternate bindings
selected by the daemon from detected hardware. GGUF + Unsloth Dynamic 2.0 is the portable weight seam.

### 1.C — Pooled / distributed (the "compute pooling" in the epoch name)

Three architecturally distinct 2026 options, plus a fourth that is not really "sharding":

- **Job-routing to the least-loaded owned daemon (RECOMMENDED default, §3).** Each of the user's
  machines runs a full Tier-B daemon; the control plane routes an `inference.run` job to whichever
  owned node is idlest / best-fits the model class. No tensor/pipeline sharding, no cross-node network
  on the hot path. This *is* VISION's "scheduler matches task profile to node profile" [VISION §E7]
  and it is the least-overhead, most future-proof substrate.
- **exo (exo-explore) — the model-SHARDING binding for Apple-heavy LANs.** **exo 1.0** ships
  **auto-discovery** (no manual config), **RDMA over Thunderbolt 5 (99% latency reduction)**, splits
  a model across devices by a realtime topology view, and exposes **OpenAI / Ollama-compatible APIs**.
  Runs DeepSeek V3 671B across a Mac-Mini/Studio cluster [github.com/exo-explore/exo; exolabs.net].
  Best when one model is **too big for any single node** and the fleet is Apple Silicon on a fast LAN.
- **Parallax (GradientHQ) — the heterogeneous/over-internet sharding binding.** Decentralized,
  **pipeline-parallel**, two-phase scheduler (model allocation + request-time GPU pipeline selection),
  paged-KV + continuous batching, **OpenAI-compatible**, cross-platform, works over standard internet
  connections — the right binding for a **mixed** fleet (some NVIDIA, some Apple, some remote)
  [github.com/GradientHQ/parallax; arxiv 2509.26182].
- **llama.cpp RPC — simplest sharding, LAN-only, use with caution.** Offloads model+KV over TCP to
  worker nodes; trivial to stand up. But "RPC is **not designed to make inference faster**" — if the
  model already fits on one node, RPC *slows* it via network overhead — and it is **insecure by
  default (never expose to internet; Tailscale/VPN required)** [ggml-org/llama.cpp tools/rpc;
  fungies.io multi-node 2026]. Fine as a break-glass "one model spans two boxes on my LAN" path;
  never the routing default.
- **Petals / Kalavai — internet-scale volunteer pools, deferred.** BitTorrent-style block-hosting
  across strangers' machines; democratizes 176B-class inference but at higher latency and with the
  trust/verification problem VISION explicitly parks [VISION §E7; sharedllm.org comparison;
  yandex Petals]. This is the "credits spendable across *other users'* machines" future — gated
  behind the pricing/trust epoch, not this one.

**Pick:** `pooled-frontier` class = **job-routing to the least-loaded owned daemon by default**;
for the genuine "model won't fit one node" case, bind **exo** (Apple LAN) or **Parallax**
(heterogeneous / over-internet) behind the *same* `InferenceProvider` port — a provider swap, not a
re-architecture. Both expose OpenAI-compatible APIs, so the adapter is the same one Tier B uses.

### 1.D — Hosted fallback (already shipped)

`hosted-frontier` class = the existing **Bedrock** (Claude Sonnet/Haiku) and **OpenRouter** transports
already in the registry [chat_model_registry.py]. OpenRouter is also the cheap-frontier open-weight
path: **DeepSeek V4** (released 2026-04-24, MIT-licensed, 1.6T/49B-active Pro + 284B/13B Flash, 1M
context) [felloai DeepSeek V4; lambda.ai DeepSeek V4], GLM-4.6, Qwen. Nothing new to build; this tier
is the floor the ladder falls to when A–C can't serve.

---

## 2. The job envelope — `inference.run` capability + `InferenceProvider` port

An inference request is a daemon-protocol job. Substrate declares the capability + the port; the
control plane binds the provider (exactly as `desktop.ts` declares four verbs + `DesktopProvider` and
binds Hetzner). New file: `packages/capabilities/src/inference.ts`.

### 2.1 The port (streaming is the one shape difference vs desktop)

Chat is token-streamed, so the port's run method yields an async stream rather than resolving once —
the single deliberate departure from the `DesktopProvider` shape. Everything else mirrors it: a
fail-closed default, credentials held only by the bound impl, substrate holds none.

```ts
/** A resolved model class → the concrete thing that will run. The router picks this; the port runs it. */
export type InferenceTier = "browser" | "daemon-local" | "remote-peer" | "server";

export type InferenceRequest = {
  /** Model CLASS, never a concrete id (Q6). The provider maps class → the id it actually loads. */
  readonly modelClass: "on-device-small" | "local-mid" | "local-large" | "pooled-frontier" | "hosted-frontier";
  readonly messages: ReadonlyArray<{ role: "system" | "user" | "assistant"; content: string }>;
  readonly maxTokens?: number;
  /** Hard privacy floor: the request refuses any tier whose data-locality is weaker than this. */
  readonly maxDataLocality: "on-device" | "user-owned" | "hosted";
};

export type InferenceChunk =
  | { readonly kind: "token"; readonly text: string }
  | { readonly kind: "done"; readonly tier: InferenceTier; readonly modelId: string;
      readonly inputTokens: number; readonly outputTokens: number }
  | { readonly kind: "error"; readonly code: string; readonly message: string };

/** The one seam substrate exposes. Local/pooled/hosted are implementations; substrate binds none. */
export interface InferenceProvider {
  /** Streams tokens. The impl resolves class → id, enforces its own tier, and reports usage in `done`. */
  run(input: InferenceRequest): AsyncIterable<InferenceChunk>;
  /** What this provider can serve right now — the router reads it to build the fall-down ladder. */
  capabilities(): Promise<{ readonly tier: InferenceTier; readonly classes: readonly string[];
    readonly dataLocality: "on-device" | "user-owned" | "hosted"; readonly healthy: boolean }>;
}

/** Fails closed until the control plane binds a real provider — the honest floor (mirrors desktop.ts). */
export const failClosedInferenceProvider: InferenceProvider = Object.freeze({
  run: async function* () { throw new Error("[inference] no provider configured — inference is unavailable"); },
  capabilities: () => Promise.resolve({ tier: "server", classes: [], dataLocality: "hosted", healthy: false }),
});
```

### 2.2 The capability descriptor

```ts
export const inferenceRunCapability = defineCapability<
  InferenceRequest, { streamId: string }, { readonly provider: InferenceProvider }, { readonly action: string; readonly modelClass: string }
>({
  id: "inference.run",
  input: inferenceRequestSchema,          // zod; .strict(); maxTokens bounded (hostile-frame budget, T-65-02 style)
  output: z.object({ streamId: z.string().min(1) }).strict(),
  risk: "exec",                            // it runs a model / spends compute — the frozen R-04 "exec"
  // NOTE: reversible (no reversibility field). Running inference destroys nothing; only HOSTED tiers
  // spend money, and that is governed by the cost class + the per-run ceiling, not the confirm modal.
  cost: "moderate",                        // class-dependent at runtime; declared nominal today (INV-1)
  describe:
    "Run a text-generation request against a model CLASS (never a fixed model). The router resolves " +
    "the cheapest tier that meets the request's privacy floor: on-device browser, the user's own " +
    "machine, the user's pooled fleet, or a hosted model as fallback. Streams tokens back.",
  source: "builtin",
  trust: "first-party",
  scope: (input) => ({ action: "inference.run", modelClass: input.modelClass }),
  execute: (input, ctx) => startStream(ctx.provider.run(input)),  // returns a streamId; tokens ride the wire
});
```

### 2.3 How it rides the daemon wire (no new MsgType needed)

The daemon protocol is **frozen** (`packages/daemon-protocol/src/envelope.ts` — 12 MsgTypes, additive
only). `inference.run` rides the existing `tool.request` / `tool.result` channel: add `"inference.run"`
to the `toolNameSchema` discriminated union in `packages/daemon-protocol/src/tools.ts` (an **additive**
union arm — the frozen-contract-legal change), with token chunks streamed as ordered
`session.output`-style frames keyed by the returned `streamId`. No new envelope type, no protocol
break — the guardrail-2 promise ("inference jobs are just new job types") paid off literally.

### 2.4 Router = one pure function over provider `capabilities()`

The tier ladder (§1) is a pure resolver, not a switch buried in call sites: given the request's
`modelClass` + `maxDataLocality` and the live `capabilities()` of each bound provider, pick the
cheapest healthy tier that satisfies both, else fall down toward hosted, else fail closed. This is the
`ownership.ts`-style "one function, no inline logic at call sites" discipline the house already uses.

---

## 3. Pooling — the recommendation, decisively

**Default = job-routing to the least-loaded owned daemon. Model-sharding (exo/Parallax) is an opt-in
provider binding for the "won't fit one node" case only.**

Rationale:

1. **Least overhead.** Job-routing has **zero cross-node traffic on the hot path** — the whole model
   runs on one node; only the request/response crosses the network. Tensor/pipeline sharding pays
   per-token inter-node latency and (llama.cpp RPC's own docs) can be *net-slower* than one node when
   the model already fits [ggml-org/llama.cpp tools/rpc]. Most personal models fit one modern node.
2. **Matches the vision verbatim.** "Scheduler matches task profile (size, latency, urgency) to node
   profile (strong/weak setups); low-urgency big-model jobs can shard across weak nodes" [VISION §E7]
   — job-routing is the scheduler; sharding is the *low-urgency-big-model* special case, reached by
   swapping the provider, not the architecture.
3. **Most future-proof.** exo, Parallax, vLLM, Ollama, and llama.cpp-RPC **all expose OpenAI-compatible
   APIs** — so "route a job to a node" and "route a job to a sharded cluster" are the **same adapter**
   behind the `InferenceProvider` port. The pooling strategy becomes a runtime config, not a rewrite.
4. **Trust boundary stays inside the user's fleet.** Default pooling only ever touches machines the
   *same user* owns (`data_locality: "user-owned"`), which sidesteps E7's parked
   trust/verification/pricing problem entirely [VISION §E7]. Cross-*user* pooling (Petals/Kalavai
   class) stays behind the pricing/credits gate.

Sharding-binding selection when a model genuinely won't fit one node: **exo** for an all-Apple LAN
(Thunderbolt-5 RDMA, auto-discovery), **Parallax** for a heterogeneous or over-internet fleet
(pipeline-parallel, two-phase scheduler). Both are OpenAI-compatible → same adapter as Tier B.

---

## 4. Future-proofing — what locks us in vs keeps us flexible

| Keeps us flexible (LEAN IN) | Locks us in (KEEP BEHIND THE PORT) |
|---|---|
| **Model CLASS abstraction** — callers say `local-mid`, never `qwen3.6-35b`. Model churn = a registry edit. | **Concrete model ids / prompt-format quirks** — never leak past the provider impl. |
| **`InferenceProvider` port** — local/pooled/hosted are bindings; new runtime = new impl. | **TensorRT-LLM engine files** — hardware-specific, rebuild per GPU. Optional accelerator only. |
| **GGUF + Unsloth Dynamic 2.0 quant** — one weight format across llama.cpp/Ollama/exo(convert)/MLX. | **NIM containers** — NVIDIA-only; convenience binding, never the contract. |
| **OpenAI-compatible wire** — Ollama/vLLM/exo/Parallax all speak it → one adapter. | **Chrome Prompt API (`window.ai`)** — Chrome-only, non-portable. Progressive enhancement, never assumed. |
| **`execution_locus` axis already in the registry** — `remote-peer` reserved, `daemon-local` additive. | **Vendor-hosted-only models** — fine as `hosted-frontier` floor, never the only path for a task. |

The single most important lock-in guard: **the router only ever sees classes and the port; no call
site names a model, a framework, or a wire format.** Everything the 2026 launch wave will make stale
(which quant, which runtime, which sharding lib) lives on the far side of `InferenceProvider`.

---

## 5. Production gate — what "production-ready" means for E7

- **Guardrails (registry as safety model, INV-4/INV-5).** `inference.run` is a `defineCapability()`
  entry; unregistered = fails closed from every consumer. `risk: "exec"` drives the ONE permission
  model; no bespoke confirm flow. **Hosted-tier** runs declare a per-run **cost ceiling** enforced in
  the loop and surfaced in the UI (Q5 "cap first, tune later" [NEG Q5]) — the only tier that spends
  real money.
- **Privacy is a routing input, not a footnote.** Every provider reports `dataLocality`
  (`on-device` / `user-owned` / `hosted`); the request's `maxDataLocality` is a **hard floor** — a
  request marked `on-device` can NEVER be routed to a hosted model, even as fallback. This is the
  product's defensible stance made structural: **local = data never leaves**, and the UI states the
  tier that served each turn honestly (extends the registry's existing $0/browser-locus honesty
  convention D-08).
- **Cost / latency.** Tiers A–C are $0 (device/electricity); the ladder resolves cheapest-first, so
  hosted spend happens only when the class + privacy floor force it. Latency budget per class is a
  measured phase criterion (§7), not an assumption.
- **Fallback.** The router falls **down** the ladder on any unhealthy tier (device lacks WebGPU →
  daemon; daemon offline → pool; pool empty → hosted), and **fails closed** only when the privacy
  floor forbids the only remaining tier — surfaced with a reason, never a silent hosted upgrade.
- **Observability.** Every run emits a ledger row carrying the owner principal (INV-13), the resolved
  tier + model id, token counts, and latency — the same `chat_cost_ledger` pattern already shipped.
  Local/pooled rows cost $0 but are still metered for the "how much did my fleet do" surface.

---

## 6. Confidence & open questions

| Area | Confidence | Basis |
|---|---|---|
| Browser tier (Chrome Prompt API stable, WebLLM, transformers.js v4, Bonsai) | HIGH | Official Chrome docs + HF release + multiple 2026 sources |
| Local tier (Ollama default, llama.cpp/MLX/vLLM roles, GGUF+Unsloth) | HIGH | Red Hat + multiple converging 2026 comparisons + Unsloth official |
| Pooling (job-routing default; exo/Parallax sharding) | MEDIUM-HIGH | Project repos + arxiv; the *recommendation* is an architecture judgment, not a benchmarked fact |
| Job-envelope / port design | HIGH | Direct read of `capability.ts`, `desktop.ts`, `envelope.ts`, both registries |
| DeepSeek V4 / Bonsai specifics | MEDIUM | Live 2026 secondary sources; weeks-old, re-verify pins at planning |

**Open questions carried to phase planning:**
1. **Pricing/credits/trust** — VISION parks this as its own venture decision [VISION §E7]; default
   pooling (own-fleet only) sidesteps it, but cross-user pooling needs the pricing epoch first.
2. **Streaming over the frozen wire** — confirm the `session.output`-keyed-by-`streamId` framing
   (§2.3) at CD-style protocol review; it is additive but touches the frozen contract's neighborhood.
3. **Model-class catalogue** — the concrete class → id table is a registry populate; define it with
   the user at planning (which classes, which default id per tier).
4. **Bonsai / DeepSeek V4 pins** — re-verify versions live; both are weeks old at time of writing.

---

## 7. Phase breakdown (ROADMAP.md house style — lifts into `/gsd:new-milestone`)

Epoch sequencing per VISION: **after E4 (daemon) + real multi-user tenancy + demonstrated demand**
[VISION §E7 gate]. Five phases; numbers assigned at milestone creation.

### Phase E7-1: Inference Capability & Provider Port (substrate)
**Goal:** `inference.run` exists as a `defineCapability()` entry with an `InferenceProvider` port and
a fail-closed default, and the model registry gains the `daemon-local` locus + a model-CLASS catalogue
— the LLM/genui/canvas read one declaration (INV-1).
**Depends on:** E4 capability registry (Phase 68) + daemon job envelope (Phase 65).
**Success Criteria:**
  1. `inference.run` resolves by registry id; unregistered fails closed from every consumer.
  2. `InferenceProvider` port + `failClosedInferenceProvider` land in `packages/capabilities`; substrate
     holds zero credentials and zero framework imports.
  3. The registry's `execution_locus` gains `daemon-local`; a model-class catalogue (class → default id
     per tier) exists in both TS and Python registries with a matching content hash (FOUND-2).
  4. `risk: "exec"` drives the ONE permission model; no bespoke confirm flow (INV-4).

### Phase E7-2: In-Browser Tier (zero-cost private inference)
**Goal:** `on-device-small` runs entirely in the browser — Chrome Prompt API when present, WebLLM as
portable fallback, transformers.js v4 for embeddings/classification — with `dataLocality: "on-device"`
enforced as a hard floor.
**Depends on:** E7-1.
**Success Criteria:**
  1. Feature-detected `window.ai` (Chrome Prompt API) serves a turn with no network egress (verified).
  2. WebLLM serves the same class when `window.ai` is absent (extends existing `webllm-qwen3-4b`).
  3. A request with `maxDataLocality: "on-device"` is NEVER routed off-device, even on tier failure —
     it fails closed with a stated reason instead.
  4. transformers.js v4 serves an embedding/classification utility path measured against a server baseline.

### Phase E7-3: Local-Machine Tier via the Daemon
**Goal:** The daemon exposes an Ollama-backed `InferenceProvider` (OpenAI-compatible adapter) serving
`local-mid`/`local-large` from GGUF + Unsloth Dynamic 2.0 quants, with llama.cpp/MLX/vLLM selectable
by detected hardware.
**Depends on:** E7-1, E4 daemon.
**Success Criteria:**
  1. `inference.run` routed to `daemon-local` streams tokens from a local Ollama over the daemon wire
     (additive `"inference.run"` tool arm; `streamId`-keyed `session.output` framing).
  2. The daemon selects backend from hardware (Ollama→llama.cpp on x86, MLX on Apple) transparently.
  3. `dataLocality: "user-owned"` reported; a `local-*` request never leaves the machine; $0 ledger row
     still metered (INV-13).
  4. GGUF + Unsloth Dynamic 2.0 quant loads and serves; model swap is a registry edit, no code change.

### Phase E7-4: Pooling — Job-Routing Across Owned Daemons
**Goal:** Multiple owned daemons register as nodes; the router sends each `pooled-frontier` job to the
least-loaded healthy node that fits the class — the vision's task-profile→node-profile scheduler, with
NO tensor/pipeline sharding on the hot path.
**Depends on:** E7-3, multi-daemon registration.
**Success Criteria:**
  1. Two+ owned daemons register; the router picks the least-loaded fitting node per job (verified under
     an artificial load skew).
  2. Routing touches only same-owner nodes; `dataLocality` never weakens below `user-owned` for pooled.
  3. A node going unhealthy falls the job down the ladder (pool→hosted) unless the privacy floor forbids.
  4. Per-node utilization is metered (the "what did my fleet do" surface), owner principal on every row.

### Phase E7-5: Model-Sharding Binding (opt-in) + Production Hardening
**Goal:** For "won't fit one node," an opt-in sharding provider (exo on Apple LAN / Parallax on
heterogeneous fleets) binds behind the SAME port; hosted-tier cost ceilings, the fall-down ladder, and
observability are production-hardened.
**Depends on:** E7-4.
**Success Criteria:**
  1. exo (or Parallax) binds as an `InferenceProvider` via its OpenAI-compatible API and serves a model
     too large for any single node — a provider swap, no router/caller change.
  2. Hosted-tier runs enforce a per-run cost ceiling in the loop, surfaced in the UI (Q5).
  3. The full A→D fall-down ladder is exercised end-to-end; each tier's served latency is measured and
     recorded with methodology.
  4. Every run (all tiers) emits a ledger row: owner principal, resolved tier, model id, tokens, latency.

---

## 8. Sources (live 2026)

- Chrome built-in AI / Prompt API stable (Chrome 148): https://developer.chrome.com/docs/ai/get-started , https://developer.chrome.com/docs/ai/prompt-api , https://pasqualepillitteri.it/en/news/3145/gemini-nano-chrome-built-in-ai-client-side-en
- transformers.js v4 (WebGPU rewrite, Feb 2026): https://roboaidigest.com/posts/2026-02-11-transformers-js-v4-webgpu/ , https://ucstrategies.com/news/transformers-js-v4-is-faster-than-aws-inference-and-it-runs-in-your-browser/
- Gemma 3 / 3n / 270M (on-device): https://developers.googleblog.com/en/introducing-gemma-3n/ , https://ai.google.dev/gemma/docs/gemma-3n , https://blog.google/technology/developers/gemma-3/
- Ternary Bonsai (PrismML, 1.58-bit) + Bonsai 27B on phone via WebGPU: https://www.progressiverobot.com/2026/04/16/what-is-ternary-bonsai/ , https://essamamdani.com/blog/prismml-bonsai-27b-1-bit-27b-model-runs-phone-webgpu-july-2026 , https://huggingface.co/prism-ml/Ternary-Bonsai-27B-gguf
- Local engines compared (Ollama/llama.cpp/vLLM/MLX, 2026): https://developers.redhat.com/articles/2026/06/15/llamacpp-vs-vllm-choosing-right-local-llm-inference-engine , https://contracollective.com/blog/llama-cpp-vs-mlx-ollama-vllm-apple-silicon-2026 , https://codersera.com/blog/ollama-vs-lm-studio-vs-vllm-vs-llama-cpp-vs-mlx-2026/
- Unsloth Dynamic 2.0 GGUF: https://unsloth.ai/blog/dynamic-v2 , https://modelslab.com/blog/llm/unsloth-dynamic-2-0-ggufs-quantized-llms
- NVIDIA Dynamo / TensorRT-LLM disaggregated serving (datacenter-scale): https://www.spheron.network/blog/nvidia-dynamo-disaggregated-inference-guide/ , https://github.com/NVIDIA/TensorRT-LLM/blob/main/docs/source/features/disagg-serving.md
- exo 1.0 (auto-discovery, Thunderbolt-5 RDMA): https://github.com/exo-explore/exo , https://exolabs.net/
- Parallax (GradientHQ, pipeline-parallel decentralized): https://github.com/GradientHQ/parallax , https://arxiv.org/abs/2509.26182
- llama.cpp RPC (LAN sharding, insecure-by-default): https://github.com/ggml-org/llama.cpp/blob/master/tools/rpc/README.md , https://fungies.io/multi-node-local-llm-inference-guide-2026/
- Petals / Kalavai / SharedLLM comparison (internet-scale volunteer): https://sharedllm.org/blog/sharedllm-vs-petals-vs-exo.html , https://research.yandex.com/blog/petals-decentralized-inference-and-finetuning-of-large-language-models
- DeepSeek V4 (MIT, 2026-04-24) + DeepSpec: https://felloai.com/deepseek-v4/ , https://lambda.ai/blog/deepseek-v4-the-most-expected-open-source-model , https://www.llmrumors.com/news/deepseek-deepspec-speculative-decoding-inference-economics
</content>
</invoke>
