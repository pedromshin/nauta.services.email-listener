# Distributed Inference — Phase Plan (device profiling → daemon → fleet → peer credits)

> **Status:** PLAN, 2026-07-23. Scopes the incremental delivery of distributed inference for
> polytoken, sequenced so the cheap, non-venture slice ships now and every venture-shaped risk stays
> behind an explicit gate.
> **Sources (ground truth, read before editing):**
> - `.planning/research/2026-07-22-ecosystem/distributed-inference.md` — the deep research (credit
>   economy, verification, 2026 landscape, feasibility verdicts). This plan is its operational form.
> - `.planning/research/e7-inference/ARCHITECTURE.md` — the implementation-ready E7 design (tier ladder
>   A–D, `inference.run` capability + `InferenceProvider` port, frozen daemon wire). **This plan does
>   NOT improvise past that doc's seams.** Phases 1–3 below are E7-1..5 restated; the E7 doc governs
>   their scope when the epoch opens.
> - `.planning/research/2026-07-22-FEATURE-CATALOG.md` §11 — DX-01 (`daemon-local` locus, unwired seam)
>   / DX-02 (peer pooling + credits, venture-gated).
> **What is BUILT (this branch, b7-inference):** Phase 0 only. Everything below Phase 0 is design.

---

## The seams this rides (do not re-architect them)

Two substrate seams already exist and are deliberately load-bearing (E7 ARCHITECTURE §0):

1. **The chat model registry carries the distributed-inference axis.** Both the TS boundary
   (`packages/api-client/src/router/chat/models.ts`) and the Python domain registry
   (`apps/email-listener/app/domain/services/chat_model_registry.py`) declare
   `transport: "bedrock" | "openrouter" | "browser"` and
   `execution_locus: "server" | "browser" | "remote-peer"` — with `remote-peer` **reserved, unused
   today**. Later phases activate `remote-peer` and add a `daemon-local` locus. Phase 0 reads this
   registry but changes neither locus enum.
2. **The capability substrate is the job envelope.** `packages/capabilities/src/capability.ts`
   (`defineCapability` + `InferenceProvider` port, mirroring `desktop.ts`'s `DesktopProvider`) is the
   shape Phase 1+ fills. Phase 0 does not touch it.

The one-line rule that survives every phase: **callers reason about a model CLASS, never a model id;
the router resolves class → provider binding at request time** (E7 Q6). The browser recommender in
Phase 0 is the first consumer of that discipline.

---

## Phase 0 — Device profiling + local-model recommendation  ✅ DONE (this branch)

**The safe, non-venture increment.** No peer pooling, no credits ledger writes, no real remote-peer
routing — all of that stays E7-gated below. Phase 0 only *profiles the visitor's device and suggests
the best local model it can run*, improving the already-shipped WebLLM feature.

**Shipped:**
- `apps/web/src/lib/device-profile.ts` — pure, typed, injectable-navigator device profiler. Captures
  the permission-free signals: `navigator.hardwareConcurrency` (logical cores),
  `navigator.deviceMemory` (RAM GiB, Chromium-clamped to 8), `navigator.gpu` presence + a granted
  adapter's `limits.maxBufferSize` / `maxStorageBufferBindingSize` + `adapter.info` vendor/architecture,
  and `navigator.connection.effectiveType` / `saveData`. Every signal degrades to `undefined` when the
  API is absent (Safari/Firefox/SSR) — never a throw. WebGPU detection mirrors
  `use-webllm-engine.ts`'s `detectWebGpuSupport()` so the picker's enable-gate and the recommendation
  agree. `webllmSupported` requires a *granted* adapter, not merely `navigator.gpu` presence.
- `apps/web/src/lib/model-recommendation.ts` — pure `recommendModel(profile, candidates)` resolver.
  Heuristic: no granted WebGPU adapter → `server-only`; else estimate a VRAM budget (MB) from device
  memory (`× 0.55` usable fraction), capped by the WebGPU single-buffer limit (`maxBufferSize × 4` — a
  discrete GPU reports a far larger cap than an integrated one, which is how the top tier is separated
  given Chromium clamps `deviceMemory`); keep candidates whose required VRAM ≤ budget AND params ≤ 8B
  (2026 browser cap); pick the largest by params, tie-break to the lighter build; nothing fits →
  `server-only`. Ships `SHIPPED_LOCAL_MODEL_CANDIDATES` (only the vetted `webllm-qwen3-4b`, honest by
  construction) + `candidatesFromRegistry()` mapping registry browser ids → candidates via a
  requirement lookup (unknown ids → conservative 8B/4.6GB fallback).
- `apps/web/src/app/chat/_hooks/use-device-model-recommendation.ts` — thin glue hook: profiles once on
  mount, recommends over the picker's live browser-locus rows, returns just the recommended id.
  **Suggestion-only** — never mutates the selected model, never calls `chat.setModel`, never downloads
  weights.
- Picker wiring: `model-picker.tsx` computes the recommendation and passes `isRecommendedForDevice`
  per row; `model-picker-entry.tsx` renders a non-intrusive `secondary` **"Recommended for your
  device"** badge — distinct from the accent-outline "Recommended" (current-selection) badge, and it
  **does not auto-switch** the user's model.
- Tests: `device-profile.test.ts` (mocked navigator across high-end GPU / mid laptop / low-memory
  phone / no-WebGPU / blocklisted-adapter / garbage-signal classes), `model-recommendation.test.ts`
  (device-class truth table + budget math + registry mapping helpers), and
  `model-picker-entry-device-hint.test.tsx` (jsdom behavior: badge shows only when recommended,
  coexists with the selection badge, renders on non-selected rows → proves it never forces selection).

**Exit criterion (E7 research §7 Phase 0):** recommendation shown on ≥2 real devices matches the
measured performance ranking. *Not yet field-verified* — jsdom does no layout or real WebGPU
(CLAUDE.md); confirm on real hardware via `npm run screenshot:review` / manual device testing before
declaring the exit met.

**Deliberately NOT built in Phase 0 (kept honest):**
- First-token empirical benchmark → `device_profiles` table (E7 research §6.1). Static signals lie
  (drivers, thermals); measured tok/s persisted per device would make recommendations empirical after
  one session. Deferred — it needs a new tenant-scoped table, which belongs with Phase 1 metering, not
  a web-only slice.
- Chrome Prompt API (`window.ai`) feature-detection as a zero-download tier. Progressive-enhancement
  candidate; not wired to keep Phase 0 to profiling + recommendation.

---

## Phase 1 — Daemon-local inference (= E7-2/E7-3, DX-01)

**Gate: the daemon platform ships (E4 / v2.0).** `daemon-local` locus via the user's OWN machine,
**$0 cost** (electricity), data never leaves the device.

- Add the `daemon-local` value to `execution_locus` in BOTH registries (TS + Python, content-hash
  matched — FOUND-2).
- `inference.run` capability + `InferenceProvider` port + `failClosedInferenceProvider` land in
  `packages/capabilities` (E7 ARCHITECTURE §2). Ollama is the default binding (OpenAI-compatible → ~1
  adapter); llama.cpp / MLX / vLLM selectable by detected hardware behind the port.
- Rides the **frozen** daemon wire as an *additive* `"inference.run"` arm on `toolNameSchema`
  (`packages/daemon-protocol/src/tools.ts`), tokens streamed as `streamId`-keyed frames. No new
  MsgType.
- `dataLocality: "user-owned"` reported; `$0` ledger row **still metered** (owner principal + per-run
  token counts). **This metering IS the future credit meter** — get owner-principal + token counts
  right here and the Phase 3 credit ledger is a *view*, not a new system.

**Triggers into this phase:** daemon liveness in production + AI-02 capability wiring closeout
(FEATURE-CATALOG §11 "foundational order" item 10: "DX-01 when daemon work resumes").

---

## Phase 2 — Own-fleet routing (= E7-4)

**Gate: Phase 1 shipped + multi-daemon registration.** Multiple machines the *same user* owns register
as nodes; the router sends each job to the least-loaded healthy node that fits the class — the vision's
task-profile→node-profile scheduler, **no tensor/pipeline sharding on the hot path** (job-routing has
zero cross-node traffic on the hot path; sharding via exo/Parallax stays the E7-5 opt-in for
"won't-fit-one-node" only).

- Routing touches only same-owner nodes; `dataLocality` never weakens below `user-owned`. This
  sidesteps E7's parked trust/verification/privacy problem **entirely** because no stranger's hardware
  is involved.
- Per-node utilization metered ("what did my fleet do"), owner principal on every row.
- Phase 0's per-device profiles + the daemon's honest hardware probe feed the same recommender that
  the router reads — profiles become a routing input, not just a picker hint.

**Trigger:** demonstrated demand for offloading beyond a single machine (a user with ≥2 daemons).

---

## Phase 3 — Peer pooling + credits accounting  🚧 VENTURE GATE (DX-02) — DO NOT BUILD

This is the parked venture decision (VISION §E7; E7 ARCHITECTURE §6 open question 1; research §4).
Scope if — and only if — opened: **trust circle only** (own devices + invited workspace members), **no
cash-out, no token, no strangers, closed-loop.** Everything below is a *sketch to bound the gate*, not
an instruction to implement.

### 3a. Credits ledger — schema sketch (denominated in SERVICE UNITS, never a floating asset)

The single biggest lesson from the 2026 DePIN supply collapses (research §3.2/§4.1): denominate in
**normalized standard-tokens per model class**, centrally issued, never a crypto token whose price
decouples supply from demand.

```
credit_ledger (tenant-scoped from day one — VISION guardrail 1)
  id                pk
  owner_principal   fk        -- INV-13: who this balance belongs to
  workspace_id      fk        -- trust-circle boundary; cross-workspace serving forbidden in Phase 3
  entry_type        enum('earn' | 'spend' | 'grant' | 'expire')
  service_units     numeric   -- normalized standard-tokens (model-class-weighted), the unit of account
  model_class       text      -- which class the units are priced against
  execution_locus   text      -- daemon-local | remote-peer (the Phase 1 cost-ledger column, reused)
  counterparty      fk?       -- the principal served (earn) / served-by (spend); null for grant/expire
  source_run_id     fk?       -- the metered inference run that produced this entry (Phase 1 ledger row)
  replay_digest     text?     -- reserved: deterministic-replay spot-check hook (built later, not now)
  created_at        ts
```

Balance = a **view** over the Phase-1 metering rows (`SUM(earn) − SUM(spend)`), not a parallel system —
the whole reason Phase 1 gets owner-principal + token counts right.

### 3b. Earn / spend model

- **Earn:** your daemon serves an inference request for another principal *in your circle*; the
  Phase-1/2 metered run is attributed to the provider-principal as an `earn` entry (service units =
  normalized tokens for that model class).
- **Spend:** redeem service units against the **hosted-frontier tier** at an explicit,
  **budget-capped, adjustable** exchange rate. This is an *acknowledged subsidy* (Pedro pays Bedrock /
  OpenRouter real dollars; consumer-served units are near-worthless against batched-datacenter pricing
  — research §4.1). Honest framing: a loyalty/engagement mechanic to bootstrap the daemon install base,
  NOT an economy that clears at market value. Cap monthly redemption to a fixed subsidy budget.
- **Licensing:** only **MIT/Apache-weight** models eligible for serving-to-others (registry flag) —
  Llama-family license terms restrict redistribution (research §2 subproblem 10).

### 3c. BYOK interplay (ST-02)

Per-user OpenRouter/Bedrock key entry (encrypted at rest, never browser-exposed) is a **prerequisite**
for the spend side: a user redeeming credits against hosted frontier either spends Pedro's subsidy
budget or their own BYOK key. The exchange-rate/subsidy math changes entirely depending on which —
decide the promise before shipping "credits" language, because it sets expectations that are hard to
walk back (research §8 Q2/Q4).

### 3d. Prior-art caveats (why this is a venture, not an epoch — research §3/§4)

- **exo** — LAN/Thunderbolt fleet tool (own devices), *not* an internet stranger-pool; auto-discovery +
  RDMA over Thunderbolt 5. Reference for own-fleet sharding (Phase 2's opt-in), not peer credits.
- **Petals** — BitTorrent-style stranger-pooled inference; **the reference for the costs**:
  interactive-marginal latency, **no prompt privacy** against block hosts, **no economic layer at all**
  (pure volunteerism). Sending user prompts to strangers' GPUs contradicts polytoken's
  privacy-as-routing-input stance unless the request is explicitly marked shareable.
- **Verification is unsolved at practical cost:** zkML LLM proofs are ~100× slower than the inference
  (a 2000-token response ≈ 23 days to prove); TOPLOC-style activation hashing needs forking the
  runtime; TEE attestation excludes exactly the consumer hardware the vision wants to monetize.
  Phase-3 posture is therefore **trust-circle-only, verification skipped by consent**, with a
  deterministic-replay spot-check hook *designed into the schema* (`replay_digest`) but not built.
- **DePIN economics:** Akash GPU capacity fell **>57% QoQ into Q1 2026** as token rewards tightened;
  supply coupled to a floating token evaporates when you can least control it. → no token, service
  units only.

### 3e. The gate (unchanged from VISION / ENDGAME / E7 ARCHITECTURE §6)

Phase 3 opens ONLY on ALL of: **daemon platform shipped (Phase 1)** + **real multi-user tenancy**
(workspaces/teams) + **demonstrated cross-user demand from Phase 2 telemetry** (circles actually
saturate their own fleets and want more). If Phase 2 shows fleets are never saturated, Phase 3 has **no
demand and should not happen.** Open-market / cash-out / strangers / gains-sharing is **Phase 4 — not a
phase, the venture decision** (verification ≥ spot-check + TOPLOC, prompt-privacy consent or TEE
providers, credit market-making, money-transmission regulatory work, anti-fraud, provider SLAs); out of
scope for this plan entirely.

---

## Summary of gates

| Phase | What | Gate / trigger | Status |
|---|---|---|---|
| 0 | Browser device profiling + local-model recommendation (web-only, suggestion) | none — cheap slice | ✅ built (field-verify exit) |
| 1 | `daemon-local` locus + `inference.run` capability + Ollama binding, $0 metered | daemon platform ships (E4/v2.0) + AI-02 | design (E7-2/3) |
| 2 | Own-fleet job-routing across owned daemons | Phase 1 + multi-daemon registration + demand | design (E7-4) |
| 3 | Trust-circle peer serving + closed-loop credits (service units, no cash-out) | Phase 1 + real tenancy + **demonstrated cross-user demand** | 🚧 venture gate — do NOT build |
| 4 | Open market (strangers, cash value, gains-sharing) | separate venture decision | out of scope |
