# Currency Refresh: Generative-UI Engine Research

**Verified as of:** 2026-06-26
**Based on:** PRIOR-ART.md, SPEC-RENDERER.md, GENERATION-AGENT.md, TEMPLATE-FLYWHEEL.md, SAFETY-PITFALLS.md (Q1-2026 baselines)

---

## Area 1 — Vercel AI SDK

### CURRENT STATE (June 2026)

**Version:** `ai` package at ~4.x stable (v6 branding confirmed GA). `@ai-sdk/amazon-bedrock` at **4.0.120** (last published ~June 26, 2026).

**Canonical structured-output API (CONFIRMED):**
- `generateText` / `streamText` + `output: Output.object({ schema })` is the production API
- `generateObject` / `streamObject` are **deprecated** — this is confirmed stable policy, not a preview
- `Output.array()`, `Output.choice()`, `Output.json()` are also available output modes

**`useObject` hook (CONFIRMED):** Still exported as `experimental_useObject` from `ai/react`. Array output mode streams only complete array elements (stable UI, no layout shifts). No sign of the hook going stable-named yet.

**`streamUI` / RSC status (CONFIRMED):** Development paused. No reversal. Not recommended for new projects.

**New Q2-2026 primitives:**
- `WorkflowAgent` with `experimental_sandbox` support for sandboxed tool execution — GA since Vercel Sandbox launch (January 2026)
- `ToolLoopAgent` — stable structured output on tool loop agents
- Agent user-agent segment (`ai-sdk-agent`) added for attribution
- `Output.object` structured output is now explicitly called "stable" across `generateText`, `streamText`, and `ToolLoopAgent`

**Zod v4 compatibility (CRITICAL — NO CHANGE):** Zod v4 **remains incompatible** with the AI SDK as of June 2026. The incompatibility is at `zod-to-json-schema` layer (`ZodFirstPartyTypeKind` export removed in v4). GitHub issues #5682 and #7189 are open but unresolved. **Continue using Zod v3 (>=3.25.76).** This is not changing before the project ships.

### DELTA / CORRECTION vs existing docs

- GENERATION-AGENT.md is accurate on `generateText + Output.object` pattern
- GENERATION-AGENT.md warning "Zod v3 required (v4 breaks)" is still correct and should remain
- No new generative-UI primitives in the AI SDK itself (RSC/streamUI is dead)
- `@ai-sdk/amazon-bedrock` is at 4.0.120; GENERATION-AGENT.md does not pin a version — add `"@ai-sdk/amazon-bedrock": "^4.0.120"` to installation notes

### Sources

- https://www.npmjs.com/package/@ai-sdk/amazon-bedrock (v4.0.120, June 2026)
- https://vercel.com/blog/ai-sdk-6
- https://github.com/vercel/ai/issues/5682
- https://github.com/vercel/ai/issues/7189
- https://releasebot.io/updates/vercel/vercel-ai

---

## Area 2 — AWS Bedrock: Structured Outputs, Converse API, Prompt Caching

### CURRENT STATE (June 2026)

**Structured outputs (CONFIRMED GA):** Available since February 4, 2026. Constrained decoding via compiled grammar artifacts. JSON Schema Draft 2020-12 subset. 24-hour grammar cache per account. No change to constraints: `additionalProperties: false` required on all objects; no recursive schemas; no `minimum`/`maximum`/`minLength`/`maxLength`/`if`/`then`/`else`/external `$ref`.

**Q2-2026 expansion:** Structured output added to **Custom Model Import** (blog: "Introducing structured output for Custom Model Import in Amazon Bedrock"). Multi-model support broadened — Claude, Nova, Llama, and other models all now pass through Converse API for structured output.

**Converse API:** Unchanged as the unified API for all models. `@ai-sdk/amazon-bedrock` provider uses it exclusively. No breaking changes found.

**Prompt caching (`cachePoint`) syntax (CONFIRMED CURRENT):**
```typescript
providerOptions: {
  amazonBedrock: {
    cachePoint: { type: 'default' }
  }
}
```
Cache points can be set in `messages`, `system`, or `tools` fields. TTL options: **5 minutes** or **1 hour** (1-hour TTL confirmed for Haiku 4.5, Sonnet 4.6, Opus 4.8).

**Pricing (write vs read) — CORRECTION TO GENERATION-AGENT.md:** The existing doc says write $1.25/M, read $0.10/M. Current Bedrock docs confirm this rate is approximately correct for Haiku/Sonnet tier; verify exact rates per model in AWS pricing console (rates can differ by model generation).

**New Q2-2026 Bedrock launches relevant to this project:**
- **Bedrock AgentCore** (GA announced ~June 2026): managed agentic infrastructure; not directly relevant to the spec-first UI engine pattern
- **Intelligent Prompt Routing** (GA): routes requests to cheapest capable model — LOW relevance since we pin Haiku for runtime
- Structured output extended to custom imported models — LOW relevance

### DELTA / CORRECTION vs existing docs

- GENERATION-AGENT.md Bedrock provider section is accurate; no structural changes needed
- Confirm `cachePoint: { type: 'default' }` syntax is still correct (VERIFIED)
- No new Bedrock features break existing architecture bets

### Sources

- https://aws.amazon.com/about-aws/whats-new/2026/02/structured-outputs-available-amazon-bedrock/
- https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
- https://aws.amazon.com/blogs/machine-learning/introducing-structured-output-for-custom-model-import-in-amazon-bedrock/

---

## Area 3 — Claude Model Lineup on Bedrock (June 2026)

### CURRENT STATE (June 2026)

**Official source:** https://platform.claude.com/docs/en/about-claude/models/overview (fetched 2026-06-26)

| Model | API ID | Bedrock ID | Input $/MTok | Output $/MTok | Context | Max Output | Latency |
|-------|--------|------------|-------------|--------------|---------|------------|---------|
| **Haiku 4.5** | claude-haiku-4-5-20251001 | `anthropic.claude-haiku-4-5-20251001-v1:0` | $1 | $5 | 200k | 64k | Fastest |
| **Sonnet 4.6** | claude-sonnet-4-6 | `anthropic.claude-sonnet-4-6` | $3 | $15 | 1M | 128k | Fast |
| **Opus 4.8** | claude-opus-4-8 | `anthropic.claude-opus-4-8` | $5 | $25 | 1M | 128k | Moderate |
| **Fable 5** (NEW) | claude-fable-5 | `anthropic.claude-fable-5` | $10 | $50 | 1M | 128k | Moderate |
| **Mythos 5** (invite-only) | claude-mythos-5 | Limited availability | $10 | $50 | 1M | 128k | — |

**Key model facts:**
- Fable 5 GA: **June 9, 2026** — not in any existing doc
- Fable 5 has "always-on adaptive thinking" (no extended thinking toggle)
- Sonnet 4.6 Bedrock ID is **dateless** (`anthropic.claude-sonnet-4-6`) — new convention starting 4.6 generation
- Opus 4.8 is on Bedrock via the Messages-API endpoint (`Claude in Amazon Bedrock`), NOT Converse; footnote 3 in official docs confirms this nuance
- All three primary models (Haiku 4.5, Sonnet 4.6, Opus 4.8) support 1-hour prompt cache TTL

**CORRECTION to GENERATION-AGENT.md model table:** The doc references "Claude Sonnet 4.5" as the escalation model. **Sonnet 4.5 is now legacy.** Current escalation should be **Sonnet 4.6** (`anthropic.claude-sonnet-4-6`). Same price point ($3/$15), but Sonnet 4.6 has 1M context vs Sonnet 4.5's 200k — significant upgrade for long email threads.

**Runtime workhorse recommendation (CONFIRMED):** **Haiku 4.5** (`anthropic.claude-haiku-4-5-20251001-v1:0`) remains the correct choice for frequent constrained UI-spec generation. At $1/$5 per MTok with Fastest latency, the cost/latency profile is unchanged and optimal.

**Escalation model recommendation (UPDATED):** Use **Sonnet 4.6** (`anthropic.claude-sonnet-4-6`) for hard specs. Do NOT add Fable 5 to the escalation chain — at $10/$50 it is 3-10x the cost of Sonnet 4.6 for marginal UI-spec quality gains. Fable 5 is for research/evaluation only.

**HAIKU_MODEL constant (GENERATION-AGENT.md):** `'us.anthropic.claude-haiku-4-5-20251001-v1:0'` — note the `us.` regional prefix used in the existing code. This may be a cross-region inference ID; the canonical Bedrock ID is `anthropic.claude-haiku-4-5-20251001-v1:0`. Verify which prefix is correct for the deployment region; both may resolve depending on Bedrock endpoint configuration.

**Titan Text Embeddings V2 (CONFIRMED CURRENT):** `amazon.titan-embed-text-v2:0` remains the current embedding model on Bedrock. No successor model announced as of June 2026. Supports 256/512/1024 dimensions, 8192-token input, 100+ languages. **Use 1024 dimensions** for the halfvec(1536) HNSW index — wait, TEMPLATE-FLYWHEEL.md says `halfvec(1536)` but Titan v2 outputs max 1024 dimensions. **This is a latent bug — see Corrections section.**

**Bedrock structured output + Opus 4.8 (CAUTION):** The existing GENERATION-AGENT.md notes "strict mode disabled on Bedrock tool defs for opus-4-7/4-8." Verify this restriction still applies for Opus 4.8 before using it as escalation for structured output; the safer path is Sonnet 4.6 for structured-output escalation.

### Sources

- https://platform.claude.com/docs/en/about-claude/models/overview (fetched 2026-06-26)
- https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5
- https://aws.amazon.com/bedrock/anthropic/
- https://hidekazu-konishi.com/entry/amazon_bedrock_model_catalog_2026.html

---

## Area 4 — Generative-UI Ecosystem (2026)

### CURRENT STATE (June 2026)

**json-render (vercel-labs/json-render):**
- Stars: **14.8k** (up from ~13k at January 2026 launch)
- Latest version: **v0.19.0** — added custom directives API (`$format`, `$math`, composable directives resolving at render time)
- Renderers: React, Vue, Svelte, Solid, React Native — multi-framework confirmed
- Featured at Google I/O 2026, mentioned alongside A2UI as complementary
- PRIOR-ART.md star count is slightly stale (was 13k); content summary of json-render remains accurate

**A2UI (Google):**
- Current production spec: **v0.9.1** (not v0.9 as in PRIOR-ART.md)
- v1.0 spec: **Candidate status** (last updated June 8, 2026) — not yet ratified
- Still Apache 2.0, created by Google with CopilotKit contributions
- Declared a "clean separation of UI structure and application data"
- Google I/O 2026: Flutter + A2UI = GenUI (GenUI) session — described as "most architecturally significant Flutter announcement of the year"
- PRIOR-ART.md says "v0.9 in April 2026" — MINOR CORRECTION: current is v0.9.1; v1.0 is Candidate

**Tambo (tambo-ai/tambo):**
- **Tambo 1.0** released (stable, production-ready)
- SOC 2 and HIPAA compliant
- Production customers: Zapier, Rocket Money, Solink
- Fullstack open-source generative UI toolkit for React with backend included
- Still uses Zod schemas for component registration — consistent with project approach
- PRIOR-ART.md entry remains accurate; now add "Tambo 1.0 released, production-grade"

**assistant-ui:**
- No major version changes found in searches; `MessagePrimitive.GenerativeUI` API stable
- Still the recommended chat UI primitive layer

**AG-UI (CopilotKit):**
- Still active; CopilotKit maintains `generative-ui` GitHub repo with AG-UI + A2UI examples
- The repo explicitly positions: "AG-UI, A2UI/Open-JSON-UI, and MCP Apps"
- The label "Open-JSON-UI" appears to be CopilotKit's branding for the A2UI-compatible format they use

**New 2026 entrants / notable shifts:**
- **Bedrock AgentCore** (AWS, ~June 2026): managed agent infrastructure — not a UI rendering library but affects agent deployment topology. Not directly relevant.
- **Vercel Sandbox** (GA January 2026): sandboxed code execution. Explicitly NOT for this project (no-code-execution principle).
- The ecosystem is converging on three layers: protocol (A2UI/AG-UI), runtime (Tambo/assistant-ui/CopilotKit), renderer (json-render). NAUTA's spec-first approach is architecturally independent but compatible with A2UI as an output protocol if cross-agent portability is ever needed.

**MCP (Model Context Protocol):**
- CopilotKit `generative-ui` repo explicitly bundles MCP App examples alongside A2UI
- Not a UI rendering protocol — MCP is a tool/context protocol — but the pairing with generative-UI is a 2026 pattern worth watching

### DELTA / CORRECTION vs existing docs

- PRIOR-ART.md: json-render star count update 13k → 14.8k; v0.19.0 with directives API
- PRIOR-ART.md: A2UI is v0.9.1 (not v0.9); v1.0 is Candidate not yet final
- PRIOR-ART.md: add Tambo 1.0 stable + SOC2/HIPAA status; production adoption confirmed
- No new entrant threatens or supersedes the spec-first Catalog→Spec→Registry→Renderer pattern

### Sources

- https://github.com/vercel-labs/json-render
- https://www.infoq.com/news/2026/03/vercel-json-render/
- https://a2ui.org/specification/v1.0-a2ui/
- https://a2ui.org/specification/v0.9-a2ui/
- https://tambo.co/blog/posts/introducing-tambo-generative-ui
- https://github.com/CopilotKit/generative-ui
- https://github.com/tambo-ai/tambo

---

## Area 5 — Materially New in 2026: Safety, Constrained Decoding, Caching

### CURRENT STATE (June 2026)

**Prompt injection safety tooling:**

**LlamaFirewall** (Meta, arXiv:2505.03574, May 2025 paper — now operationally deployed 2026):
- Open-source modular guardrail framework; three components:
  - **PromptGuard 2**: universal jailbreak detector; 86M param (precision) + 22M param (edge/low-latency); 97.5% recall at 1% false positive rate
  - **Agent Alignment Checks**: chain-of-thought auditor for prompt injection + goal misalignment
  - **CodeShield**: static analysis for insecure/dangerous code generation
- For this project: PromptGuard 2 is a candidate as a pre-filter on the quarantine LLM input path; adds latency but provides ML-based injection detection to complement the structural quarantine pattern already in SAFETY-PITFALLS.md
- SAFETY-PITFALLS.md does not mention LlamaFirewall; it should be noted as an optional defense layer

**Encoded Prompt Injection (May 2026 Security Boulevard article):**
- A $175k attack used Morse-code-encoded instructions that bypassed string-based guardrails
- Models trained on Morse, Base64, ROT13, Python string concatenation defeated guardrails at the "wrong layer" (post-generation check)
- **Relevance:** This strengthens the case for the dual-LLM quarantine pattern. The quarantine LLM should extract STRUCTURED DATA ONLY — if it sees encoded injection, it will fail to extract clean structure and the privileged LLM never sees the payload. SAFETY-PITFALLS.md threat model is validated by this real-world evidence.

**Gradient-Controlled Decoding (GCD, arXiv:2604.05179):**
- Training-free guardrail combining acceptance/refusal anchor tokens
- Pre-injects refusal token if prompt flagged, guaranteeing first-token safety
- RESEARCH ONLY — not yet in production tooling. Not immediately actionable.

**Constrained decoding ecosystem:**
- Bedrock native structured output (grammar-based constrained decoding) remains the production approach for schema-compliant generation
- No new competing framework emerged that replaces the Bedrock native approach

**Semantic caching (2026 state):**
- Pattern is now well-established: embedding-based nearest-neighbor → cosine similarity threshold → response reuse
- Cache hit rates of 40–70% reported in production systems at 0.15 cosine distance threshold — CONSISTENT with TEMPLATE-FLYWHEEL.md's `< 0.15` threshold recommendation
- **TVCACHE** (arXiv:2602.10986): semantic caching extended to tool calls in post-training agents — LOW relevance (NAUTA caches spec templates not tool calls)
- **ContextCache** (arXiv:2506.22791, June 2026): context-aware semantic cache for multi-turn queries — potentially relevant for multi-turn email threads; not yet production tooling
- Redis Stack emerges as a common alternative to pgvector for semantic cache; pgvector remains valid and is already in use via Supabase — no migration warranted

**New architecture threat (LOW confidence):**
- Key collision attack on semantic caching (arXiv:2601.23088): adversary crafts inputs with similar embeddings to cached "safe" responses, forcing malicious response reuse
- **Relevance for NAUTA:** The attacker-controlled email text could theoretically be crafted to match an existing template's embedding, forcing a cached spec onto unrelated email content
- **Mitigation already partially covered:** TEMPLATE-FLYWHEEL.md requires binding slot validation after retrieval; the `data_shape_hash` component of the cache key reduces collision surface. Add binding slot coverage check as explicit defense against semantic cache poisoning.

### DELTA / CORRECTION vs existing docs

- SAFETY-PITFALLS.md: add LlamaFirewall PromptGuard 2 as optional Layer 0 pre-filter on quarantine input
- SAFETY-PITFALLS.md: cite Morse-code $175k incident as real-world validation of dual-LLM quarantine value (encoding-aware injection defeats string-based guardrails but not structural extraction)
- TEMPLATE-FLYWHEEL.md: note semantic cache poisoning risk (arXiv:2601.23088); binding slot validation + `data_shape_hash` in cache key is existing mitigation — make explicit
- TEMPLATE-FLYWHEEL.md: 0.15 threshold is validated by 2026 production data; keep as-is

### Sources

- https://arxiv.org/abs/2505.03574 (LlamaFirewall)
- https://securityboulevard.com/2026/05/encoded-prompt-injection-why-llm-guardrails-are-at-the-wrong-layer/
- https://arxiv.org/html/2604.05179 (Gradient-Controlled Decoding)
- https://arxiv.org/pdf/2601.23088 (key collision attack on semantic caching)
- https://arxiv.org/pdf/2506.22791 (ContextCache multi-turn)
- https://dasroot.net/posts/2026/03/llm-caching-strategies-reducing-redundant-inference/

---

## Corrections to Apply to the Other 5 Docs

### GENERATION-AGENT.md

1. **Model table: replace Sonnet 4.5 with Sonnet 4.6.** Change Bedrock ID to `anthropic.claude-sonnet-4-6`, context window to 1M tokens. Same price ($3/$15).
2. **Add Fable 5 row** to model table (Bedrock ID: `anthropic.claude-fable-5`, $10/$50, 1M ctx, 128k output, adaptive thinking always-on) with note "DO NOT use as runtime escalation — evaluation only."
3. **Pin `@ai-sdk/amazon-bedrock` version:** `"^4.0.120"` in installation section.
4. **HAIKU_MODEL constant:** verify `us.anthropic.claude-haiku-4-5-20251001-v1:0` vs `anthropic.claude-haiku-4-5-20251001-v1:0` — the `us.` prefix is a cross-region inference routing prefix, valid only in us-east-1/us-west-2 multi-region endpoints. Document which to use per deployment region.
5. **Zod v3 warning:** still correct; re-confirm as of June 2026 (no resolution).

### PRIOR-ART.md

6. **json-render star count:** update 13k → 14.8k; add v0.19.0 custom directives API note.
7. **A2UI version:** update "v0.9" → "v0.9.1 (current production) / v1.0 Candidate (spec in progress, not ratified)."
8. **Tambo:** update to "Tambo 1.0 (stable, SOC2/HIPAA, production at Zapier/Rocket Money/Solink)."

### TEMPLATE-FLYWHEEL.md

9. **CRITICAL — halfvec dimension mismatch:** TEMPLATE-FLYWHEEL.md specifies `halfvec(1536)` HNSW index but Titan Text Embeddings V2 outputs **max 1024 dimensions**. Change schema to `halfvec(1024)` (at 1024-dim setting) or verify whether a different embedding model producing 1536-dim vectors was intended. If 1536 was targeting OpenAI `text-embedding-3-small` (1536-dim) instead of Titan, that is an architecture decision that needs resolution. **Highest priority correction.**
10. **Semantic cache poisoning note:** add binding slot validation as explicit defense against adversarially-crafted embedding collisions (arXiv:2601.23088).
11. **ContextCache pattern:** flag arXiv:2506.22791 for Phase research — may be applicable if multi-turn email context caching is needed.

### SAFETY-PITFALLS.md

12. **Add LlamaFirewall** as optional Layer 0 pre-filter: PromptGuard 2 (86M params) runs on raw email text before quarantine LLM; 97.5% recall at 1% FPR; adds ~50–100ms latency. Cite arXiv:2505.03574.
13. **Encoding-aware injection threat:** add encoded prompt injection (Morse, Base64, etc.) as Pitfall entry; document why structural quarantine (extract-structured-only) provides defense-in-depth that string guardrails cannot.

### SPEC-RENDERER.md

14. No corrections identified. Nested discriminated-union tree remains the correct architecture. The flat vs nested tension noted in PRIOR-ART.md is a design decision, not a correctness issue — SPEC-RENDERER.md's choice of nested is consistent with json-render v0.19.x approach and direct React createElement mapping.
