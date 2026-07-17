# AI / LLM Architecture Audit — critical review against the 2026 field

**Date:** 2026-07-17 · **Answers:** DIRECTIVES-2026-07-17.md §D4 · **Read time:** ~35 min
**Method:** read the code first, researched the field second, judged one against the other.
**Constraint honoured:** read-only. No code changed.

---

## 0. Verdict summary — read this if you read nothing else

**Your AI architecture is better than you think it is, and your instincts about the gap are
directionally right but misdiagnosed.** Five verdicts:

**1. Do not adopt an agent framework. Not LangGraph, not Mastra, not OpenAI Agents SDK.**
You have a bounded, cost-metered, injection-quarantined tool loop that is ~158 lines of pure
functions plus a round loop. Frameworks would replace your most safety-critical, best-tested code
with someone else's, in exchange for durability features you can get from the Postgres you already
own. The honest answer here is **"or nothing"** — and this is that case.

**2. Your evals/observability claim is half wrong, and the wrong half is the damning one.**
You said "we have essentially none." False: you have `apps/email-listener/tests/evals/`, two
language-mirrored scorer libraries, an adversarial injection suite, and a live Bedrock harness.
The true finding is worse than "none": **you built eval plumbing and never connected it to water.**
- Your retrieval golden set scores an `EchoToolExecutor` — an *identity function*. recall@k against
  an echo is trivially perfect. Its own docstring admits it: *"this only proves the scaffold."*
- Your TypeScript scorers (`scoreRetrievalAtK`, `scoreInjectionResistance`, `scoreCitation`) are
  imported by **nothing** outside their own directory. Dead code.
- **Phase 57 shipped a self-improvement loop (LEARN-01/LEARN-02) and nobody knows if it improves
  anything.** Human corrections → trgm retrieval → few-shot examples into the classifier. Zero
  measurement of whether that beats cold start. It could be *hurting* accuracy right now and no
  artifact in this repo would tell you.

That last line is the entire argument for evals, and it's written in your own code, not in a blog
post. **Yes, evals are the actual bottleneck — but not because you lack tooling. Because nothing
scores real traffic.**

**3. Observability: you already have traces. You have no telescope.**
`chat_run_events` (run_id + monotonic `seq` + type + jsonb payload, unique-indexed on `(run_id, seq)`)
is an event-sourced trace log. It is *already* OpenTelemetry-span-shaped. You don't have an
instrumentation problem — you have a **readout** problem. That makes the first move much cheaper
than "adopt an observability platform."

**4. The complexity ceiling is one line of code, and it is not the model.**
`chat_stream.py` cancels the agent run when the HTTP client disconnects. **Run lifetime == browser
tab lifetime.** Close the tab, the agent dies. Every ambition in your question — desktop control,
terminal commands, coding, long-horizon automation — is blocked by that one property. The cheapest
structural fix is ~1 week, needs no new platform, and is described in §3.2.

**5. Sign up for nothing. Not tonight, not this month.**
Self-host, instrument with vendor-neutral OpenTelemetry, export to self-hosted Langfuse. $0, no
vendor SDK in your hot path, backends stay swappable. Details + the one exception in §5.

**The one-sentence path:** *Measure the loop you already have → turn your two hand-wired tool dicts
into the capability registry D2 demands → decouple the run from the HTTP connection → then, and only
then, let the system optimize itself.*

---

## 1. Vocabulary (so the rest reads cleanly)

You said you're not deep in LLM engineering. These six terms carry the whole report.

| Term | What it actually means |
|---|---|
| **Trace / span** | A trace is one end-to-end operation (a chat turn). A span is one nested step inside it (an LLM call, a tool execution). Spans have parents. A trace is a tree. Your `chat_run_events` is a *flat list* of spans — right data, missing the tree. |
| **Eval** | A test whose assertion is a *score*, not a boolean. "Retrieval recall@5 ≥ 0.8" rather than "returns 200". Offline = against a fixed dataset. Online = against real production traffic. |
| **LLM-as-judge** | Using a model to score another model's output when there's no ground truth. Powerful and treacherous — see §4.1. |
| **Durable execution** | The run's state lives outside the process, so a crash/restart resumes from the last checkpoint instead of from step 1. Temporal/DBOS/Restate sell this. |
| **Context engineering** | The 2026 successor to "prompt engineering": deciding what enters the model's context window and when. Compaction, isolation, just-in-time retrieval. |
| **Progressive disclosure** | Not putting every tool's schema in context. At 200–800 tokens per tool schema, 30 tools = ~15–30KB burned before the user types a word. You search for tools instead of listing them. |

---

# HALF 1 — What you actually have

## 1.1 The shape, honestly

```
Browser (Next.js /chat)
  └─ use-conversation-controller.ts (752 lines)
       └─ SSE ──► FastAPI  chat_stream.py (222 lines)
                    └─ RunChatTurn._execute_turn   ◄── the agent
                         ├─ ChatProviderRouter ──► BedrockChatAdapter (137 lines)
                         │                          └─ AsyncAnthropicBedrock (IAM role, no API key)
                         ├─ tool_executors: Mapping[str, ToolExecutor]   ◄── 4 tools
                         ├─ CostCircuitBreaker + chat_cost_ledger
                         └─ persists ──► chat_runs / chat_run_events / chat_messages.parts
```

**Not a tRPC router** (the brief assumed wrong). The agent is **Python**, in
`apps/email-listener`, behind FastAPI SSE. `apps/web` is a client. `apps/daemon` **does not exist
yet** — Lane C's work is net-new.

## 1.2 What is genuinely good — and rarer than you'd guess

I want to be clear before criticising, because these are not table stakes; most teams shipping
agents in 2026 have none of them.

**Hexagonal architecture with a machine-enforced boundary.** `app/domain/ports/` defines Protocols;
`app/infrastructure/` implements; `app/container.py` (1284 lines) is the only composition root. An
**import-linter** contract forbids `app.application → app.infrastructure` — and it's enforced hard
enough that the code redefines constants rather than violate it (`run_chat_turn.py:165` redefines
`_WEB_SEARCH_TOOL_NAME` locally with a comment explaining why). This is why my recommendations are
mostly *additive*: the seams already exist.

**A real cost circuit breaker.** `CostCircuitBreaker` + `chat_cost_ledger`, with a *post-round
re-check* (`_ServerRoundResult.provider_messages is None` → terminate `cost_capped`). Cost ledger
uses `onDelete: "set null"` on the conversation FK — deliberately outlives the conversation. Someone
thought about this. Most teams discover cost control after the bill.

**Injection quarantine as an architectural obligation.** `tool_executor.py` states the quarantine
contract *in the port docstring* so an executor written against the port alone can't miss it. Tool
outputs pass `validate_tool_envelope()`; failures are replaced with generic text, never the raw
payload. A hardening line is appended to the system prompt **only** on turns where a server tool is
actually reachable (`_system_prompt_for`). Tool exposure is gated by env flags with *structural*
omission (`**({X: exec} if FLAG else {})`) rather than a runtime `if`. This is genuinely good
security engineering.

**"Never silent" as a stated motto, implemented.** `PARSE_FAILURE_TEXT`,
`ROUND_CAP_EXHAUSTED_TEXT`, `SERVER_CALL_NOT_EXECUTED_TEXT`, `PARALLEL_CALL_OVERFLOW_TEXT`. Every
degenerate path surfaces visible text. Agents that fail silently are how you lose user trust
permanently.

**A capability-metadata precedent already exists.** `ChatModelCapabilities(tools, genui, streaming,
context_tokens, max_tool_rounds)` in `chat_model_registry.py`. You already model capabilities as
typed data. D2's registry is the same idea pointed at tools instead of models. **You have the
pattern; you just haven't applied it to the thing that needs it.**

**Human-in-the-loop, already solved — at the conversation layer.** The widget tools
(`emit_proposal_cards`, `emit_clarify_widget`, `emit_confirm_action`) *end the turn*, persist a
pending widget, and the conversation resumes when the human clicks. `emit_confirm_action` is
particularly sharp: the model supplies **only** a `{kind, id}` reference — never a tier, node id, or
mutation parameter — and the server re-reads the live suggestion. `additionalProperties: false` at
every level makes privilege escalation *structurally* unreachable rather than prompt-discouraged.

That last pattern matters more than it looks. **You already resume agent work across process
boundaries by replaying persisted state.** Turn N+1 reads history and continues. That is
90% of durable execution — you just do it at turn granularity, not run granularity. §3.2 exploits
this.

## 1.3 The five structural limits, in the order they will bite

### Limit 1 — Run lifetime == HTTP connection lifetime ⚠️ **the ceiling**

`chat_stream.py:131-164`, `stream_run_events`. It polls `request.is_disconnected()` and on
disconnect calls `pending.cancel()`, which raises `CancelledError` inside the agent's await point.
`_execute_turn` catches it and persists a `stopped` partial.

This is *well-engineered* — the docstring explains why `task.cancel()` is needed rather than
`aclose()` (GeneratorExit wouldn't hit the handler). It is correct code for a **chat turn**.

It is fatal for an **agent**. Consider your own stated ambitions:
- *"remote desktop control"* — minutes-long. Tab closes → dead.
- *"running terminal commands"* — a build takes 10 min. Laptop sleeps → dead.
- *"coding"* — long-horizon by definition.
- *"automations"* — must run with no browser attached at all.

Everything you asked for lives on the far side of this line. **This is the single highest-leverage
change in the report.**

### Limit 2 — Every constant is tuned for a chat turn, not an agent

| Constant | Value | Where | Why it blocks you |
|---|---|---|---|
| `_MAX_TOOL_ROUNDS` | **4** | `run_chat_turn.py:185` | A coding agent needs 50+. Round 5 = `ROUND_CAP_EXHAUSTED_TEXT` |
| `MAX_SERVER_CALLS_PER_ROUND` | **5** | `run_chat_turn_tool_loop.py:51` | Caps parallel fan-out |
| `_TOOL_EXECUTION_TIMEOUT_SECONDS` | **10.0** | `run_chat_turn.py:188` | `npm test` doesn't finish in 10s |
| `MAX_TOOL_OUTPUT_CHARS` | **2000** | `tool_executor.py:29` | A stack trace exceeds this |

These are **globals, not per-capability budgets**. `search_emails` wanting 10s and `run_terminal_command`
wanting 10min cannot coexist. Note `max_tool_rounds` is *already* per-model in
`ChatModelCapabilities` — the precedent for per-capability budgets is right there.

### Limit 3 — Capabilities are constructor parameters, not registry entries ⚠️ **blocks D2**

`RunChatTurn.__init__` takes **18 parameters**. Read the accretion pattern:

```python
knowledge_graph: KnowledgeGraphRepository | None = None,   # Phase 40-01
tool_executors: Mapping[str, ToolExecutor] = MappingProxyType({}),  # Phase 34-03
server_tool_defs: Mapping[str, dict[str, Any]] = MappingProxyType({}),  # Phase 36-02
email_repository: EmailRepository | None = None,           # Phase 54-05
source_ledger: SourceLedgerRepository | None = None,       # Phase 56-02
context_edges: ChatContextEdgeRepository | None = None,    # Phase 56-04
```

Every one carries a near-identical comment: *"Additive default (mirrors X above) — None means the
feature is structurally OFF... so every existing test/caller that never passes this stays green."*

That comment is a confession. Each new capability costs: a constructor param + a `None`-guard +
a container.py edit + a new branch in a **2263-line file** (CLAUDE.md's ceiling is 800; this is
2.8×). The cost of capability N+1 grows with N.

**This is precisely what D2 forbids.** D2 says: *"Every capability we build must be exposed as a
typed, discoverable, composable PRIMITIVE."* Today a capability is a *keyword argument*. Keyword
arguments are not discoverable — genui cannot enumerate them, the canvas cannot render them, the
daemon cannot execute them, and the LLM only sees the four that container.py hand-wired.

**But you're closer than you think.** Look:

```python
tool_executors={  LOOKUP_ENTITY_TOOL_NAME: lookup_entity_executor, ... }
server_tool_defs={ LOOKUP_ENTITY_TOOL_NAME: build_lookup_entity_tool(), ... }
```

Two parallel dicts, same keys, hand-maintained in lockstep. **That is a registry that hasn't been
told it's a registry.** Zipping them into one `Capability` record is a small, mechanical refactor
(§3.1) — and it's D2's spine.

### Limit 4 — One agent, no parallelism, by explicit design

`_AGENT_ID = "chat-agent-v1"` with the comment *"SEAM-04: one agent, one run per turn today."*
Honest and deliberate. But "advanced agents, graphs" from your question means subagents with
isolated context — which the 2026 consensus says is *the* reliability mechanism (Anthropic's own
multi-agent system spawns subagents with clean windows returning 1–2K-token summaries). Nothing in
the schema blocks this: `chat_runs` has `agentId` and `conversationId` already. You'd need a
parent-run FK and a spawn primitive. **Not blocked — just unbuilt.**

### Limit 5 — The trace is flat and unreadable

`chat_run_events` has `seq` but **no `parent_span_id`**. So a tool call inside round 3 is a sibling
of the turn, not a child. Nesting must be inferred. And nothing reads these events except the SSE
transport and two e2e specs — there is no UI, no export, no aggregate query. You are recording
flight data into a black box nobody opens.

## 1.4 The eval situation, precisely

**What exists:**

| Artifact | Status |
|---|---|
| `tests/evals/test_injection_adversarial_suite.py` (173 ln) | ✅ **Real.** `@pytest.mark.unit`, runs in CI, fixture-driven, tier-filter assertions |
| `tests/evals/test_web_search_injection_suite.py` (118 ln) | ✅ **Real.** 10 adversarial fixtures |
| `tests/evals/test_live_injection_harness.py` (330 ln) | ⚠️ **Real but dark.** `@pytest.mark.integration` + `skipif(not bedrock_credentials_available)`. CI has no Bedrock creds → **never runs in CI** |
| `tests/evals/test_retrieval_golden_set.py` (107 ln) | ❌ **Scores an echo.** Round-trips through `EchoToolExecutor`. Docstring: *"Real (non-identity) scoring lands with Phases 36/37... this only proves the scaffold"* — Phases 36/37 shipped; the eval was never upgraded |
| `_scorers.py` / `packages/genui/src/eval/*.ts` | ⚠️ **Mirrored, tested, and orphaned.** Only `PAGE_IDEAS` is imported by app code (`page-ideas-island.tsx:45`). The scorers themselves: zero callers |
| CI eval job | ❌ **None.** `grep -rn "eval" .github/workflows/` → nothing |
| Observability deps | ❌ **Zero.** No otel, langfuse, braintrust, phoenix, langsmith anywhere in `pyproject.toml` / `package.json` |

**The pattern:** security evals are real and run; **quality evals are scaffolds**. That's a coherent
story — Phase 38's adversarial gate was a *release gate*, so it got built for real. Nothing ever
forced a quality number to exist, so none does.

**The consequence, stated plainly:** you cannot currently answer *"is the AI getting better or
worse?"* for any surface — extraction, chat, genui, retrieval. Not approximately. At all. And you
shipped a learning loop in Phase 57 whose entire purpose is to make one of those numbers go up.

---

# HALF 2 — The field, judged against your structure

Researched mid-2026 state, then asked one question of each: **what would this buy *us*, given what
§1 found?**

## 2.1 Agent frameworks — verdict: **REJECT (all of them)**

| Framework | 2026 status | Verdict for you |
|---|---|---|
| **LangGraph** | Market leader, 34.5M monthly downloads, Uber/Klarna/LinkedIn/JPMorgan, 400+ in prod | **Reject.** Steal the checkpointer idea, not the dep |
| **Vercel AI SDK 6** | `ToolLoopAgent`, stable MCP+OAuth, HITL approval, DevTools. Shipped Dec 2025 | **Reject for the server** (your agent is Python). **Adopt-later, scoped to `apps/daemon`** if that's TS |
| **OpenAI Agents SDK** | Apr 2026 overhaul: sandboxing, sub-agents, Codex-style FS tools | **Reject.** Single-provider. You're Bedrock + IAM, no API keys. Direct conflict |
| **Mastra** | Replit/PayPal/Brex, $13M YC W25, Replit Agent 3: 80%→96% task success | **Reject.** TypeScript; your agent is Python |
| **CrewAI** | Role-based delegation | **Reject.** Solves a problem you don't have |

**The reasoning — and this is the important part.** A framework's value is the *loop*: call model →
execute tools → feed results → repeat, with stop conditions. You have that. It is 158 lines of pure
functions plus a bounded round loop, and it is wrapped in things a framework will **not** give you:
your injection envelope gate, your cost breaker with post-round re-check, your tier-quarantine
contract, your never-silent text constants, your `emit_confirm_action` reference-only privilege
model.

Adopting LangGraph means deleting your most security-critical, best-tested code and re-earning those
properties inside someone else's abstraction. **What you'd gain is durability/checkpointing — which
is a Postgres feature, and you own a Postgres.**

Note what Vercel's `ToolLoopAgent` actually is: `stopWhen: stepCountIs(20)`. You have
`_MAX_TOOL_ROUNDS = 4`. **That's the same abstraction. Yours is smaller and yours is yours.** The
gap is 4 vs 20 and a per-capability budget — a constant, not a framework.

> **The "or nothing" answer you asked for is here.** This is the place where the right move is to
> build nothing and adopt nothing. Your loop is not the weak part of your system.

## 2.2 Evals + observability — verdict: **ADOPT, this month, this is the bottleneck**

| Tool | 2026 status | Verdict |
|---|---|---|
| **OpenTelemetry GenAI semconv** | CNCF-graduated. semconv 1.40/1.41 defines `create_agent`, `invoke_agent`, `execute_tool` spans + `gen_ai.client.token.usage`. **Still "Development"/experimental** | ✅ **Adopt as the wire format** — but don't chase conformance |
| **Langfuse** | OSS, self-hostable, ClickHouse-backed, **acquired by ClickHouse Jan 2026**, free self-hosted, no per-seat | ✅ **Adopt, self-hosted, as an OTLP sink** |
| **Arize Phoenix** | OTel-native, self-host free (Elastic License 2.0), strong OSS eval-metrics lib | ⬜ **Viable equal alternative.** Pick Langfuse for lower ops |
| **Braintrust** | Eval-native traces, CI/CD gates. Free 1M spans; Pro **$249/mo** | ⏸ **Adopt-later.** Stage 4+, only if eval-CI-gating becomes the bottleneck |
| **LangSmith** | LangChain-coupled | ❌ **Reject.** You have no LangChain |

**The decisive architectural call — this one matters:**

> **Instrument with the vendor-neutral OpenTelemetry SDK. Export OTLP to a self-hosted Langfuse.
> Never put a vendor SDK in the agent's hot path.**

Three reasons, all yours:
1. **Your supply-chain rule.** Your standing rule is research-and-reuse but avoid unvetted deps.
   `opentelemetry-sdk` is CNCF-graduated with enormous scrutiny. A vendor SDK is not. This is the
   difference between depending on the *protocol* and depending on the *company*.
2. **Backends stay swappable.** Langfuse → Phoenix → Braintrust becomes a config change, not a
   refactor. You're pre-decision on which you'll want; don't spend the decision now.
3. **Your seams already fit.** `BedrockChatAdapter.stream` and `ToolExecutor.execute` are exactly
   `invoke_agent` and `execute_tool`. Two decorators. The semconv was practically designed for your
   shape.

**Caveat, honestly:** semconv is still experimental. Attribute names will churn. That's fine —
you're buying the *span tree*, not the attribute names. Don't build dashboards that assume stability
yet.

### The concrete first move (you asked for a specific tool, a specific first eval, a specific first trace)

**First trace:** an OTel span around `RunChatTurn._execute_turn` (→ `invoke_agent`) with a child
span per `ToolExecutor.execute` (→ `execute_tool`), carrying the token counts `BedrockChatAdapter`
already captures in `UsageDelta`. Export OTLP → `docker compose up langfuse`. **~1 day.** You
already run Docker Desktop and local Supabase. On day 2 you can see, for the first time, what your
agent actually does in production.

**First eval — and this is the one that earns its place:**

> **"Does LEARN-02's correction-retrieval few-shot actually beat cold start?"**

Hold out a slice of `entity_type_corrections`, run `SuggestEntityTypesUseCase` with
`corrections=None` (cold start) vs. `corrections=repo` (trgm few-shot), measure classification
accuracy against the held-out human labels. Why this one, above every other candidate:

- **The labels already exist and cost $0.** `entity_type_corrections` is
  `(previous_entity_type_id → corrected_entity_type_id)` — a human said "you were wrong, it's this."
  That is a hand-labelled ground-truth dataset you have been accumulating and never used. Most
  teams pay for this. You have it and it's sitting idle.
- **No LLM judge needed.** It's classification. Accuracy is unambiguous. You completely sidestep the
  judge-calibration swamp (§4.1) on your first eval — exactly where you want to sidestep it.
- **It's the highest-volume AI decision in the product.** Every ingested email.
- **It scores the real thing, not an echo.** The precise failure of the golden set.
- **It can kill or validate a shipped feature.** You built LEARN-02 on the hypothesis that
  correction-retrieval helps. That hypothesis is untested. If the answer is "no lift," you've found
  a real bug. If it's "+12%," you have your first number that can go up — and *that number is what
  GEPA optimizes in Stage 4.*

**~2 days. No new platform. No signup.** And it converts your dead scorer libraries into live code.

## 2.3 Memory / retrieval — verdict: **ADOPT the discipline, BUILD nothing, BUY nothing**

2026 consensus: agentic RAG is the baseline (the agent decides what to retrieve and iterates);
context engineering replaced prompt engineering; the three levers are **compaction** (summarize and
reinitiate near the window limit), **isolation** (subagents with clean windows returning 1–2K-token
summaries), and **just-in-time retrieval** (pull by lightweight identifier only when needed).

Judged against you:
- **Agentic RAG: you already have it.** `search_emails` / `search_knowledge` / `lookup_entity` /
  `web_search` are model-chosen, iterated over up to 4 rounds, `tool_choice` never forced (D-02).
  That *is* agentic retrieval. You built the 2026 baseline and didn't label it.
- **Just-in-time: you already have it.** `emit_confirm_action` passes a `{kind, id}` reference and
  the server re-reads live. Textbook JIT.
- **Graph RAG: you already have it** — `knowledge_nodes` / `knowledge_node_edges` /
  `chat_context_edges` with tier semantics, plus two independent context-injection pipelines
  (thread/cluster and linked-context).
- **Compaction: you do not have it.** `_trim_history_to_budget` **drops** old messages. That's
  truncation, not compaction — you lose the information instead of summarizing it. This is a real
  gap, but it only bites on long conversations. **Adopt-later** (Stage 3).
- **Isolation: you do not have it** (Limit 4). Stage 3.

**Verdict: reject Mem0/Zep/LlamaIndex.** You'd be adding a dependency to get a worse version of the
graph you already own. The gaps (compaction, isolation) are ~100 lines each against your existing
schema, not a platform purchase.

## 2.4 MCP — verdict: **ADOPT as an export surface, REJECT as internal plumbing**

2026 status: MCP won as the interop standard (Slack, GitHub, Google, Stripe, Figma, Cloudflare,
Linear, Sentry all ship servers). The criticism is equally real: **tool schemas cost 200–800 tokens
each**; 20–30 tools = 15–30KB of context burned before the user types. The fixes are Anthropic's
Tool Search Tool (**~85% token reduction** — semantic search over tools, load only matching schemas)
and Cloudflare's Code Mode (**98%+**).

**For you, two conclusions — and the second is load-bearing for D2:**

1. **Don't route internal calls through MCP.** Putting a protocol between `run_chat_turn.py` and
   `search_emails_executor.py` — two modules in one repo — buys serialization overhead and a token
   tax. Your `ToolExecutor` Protocol is better *for internal use*.
2. **Do make the registry MCP-*shaped*.** The daemon (Lane C) is a separate process on a possibly
   remote machine. That is exactly MCP's actual job, and it's the seam where the standard pays. If
   `Capability` carries `{name, description, input_schema (JSON Schema), risk, cost}`, it projects
   to MCP for free — and you inherit the ecosystem (Playwright MCP, filesystem, git) without
   adopting MCP internally.

> **⚠️ The finding you'd otherwise learn the hard way.** Today: 4 tools ≈ 2–3K tokens. Fine.
> D2's vision is *dozens* of capabilities. At 30 you're burning 15–30KB per turn — on a 200K-token
> Claude that's tolerable; on your registry's smaller models (`context_tokens=8_192`,
> `context_tokens=32_000` in `chat_model_registry.py`) **it's fatal**. Your model registry already
> declares these limits — the arithmetic is sitting in your own code.
>
> **Therefore the registry must support search/progressive disclosure from day one.** Not
> enumeration. This is a design constraint on Stage 1 that you would not have known to impose, and
> retrofitting it after genui composes against a flat list would be painful.

## 2.5 Durable execution — verdict: **ADOPT-LATER (DBOS), and probably never need it**

| Option | Fit |
|---|---|
| **DBOS** | Best fit *if needed*: durability via **Postgres only** — zero new infra. You have Postgres |
| **Temporal** | Most mature, richest retry/timeout policies. Heavy: new service, workers, new mental model |
| **Restate** | Lighter, journal prevents duplicate execution on resume, serverless-friendly |
| **LangGraph checkpointer** | Only if you adopted LangGraph. You shouldn't (§2.1) |

**The critical insight — and this is where reading your code beats reading the field:** you don't
need a durable-execution *platform* to get durable execution, because **you already have the hard
part.**

`chat_run_events` is an append-only, monotonically sequenced (`seq`), unique-indexed
(`idx_chat_run_events_run_seq`) event log per run. **That is an event-sourced journal.** Temporal's
core trick — replay the event history to reconstruct state at step N — is a thing your schema
already supports. Your widget flow *already* resumes agent work across process boundaries by
replaying persisted state.

So: **don't buy durable execution. Finish the one you accidentally built.** §3.2. Revisit DBOS only
at the trigger in §3 Stage 3.

## 2.6 Computer / browser use — verdict: **ADOPT Playwright, REJECT vision-based computer use**

2026 reliability benchmarks are unambiguous — DOM-driven beats pixel-driven by 12–17 points:

| Stack | Reliability |
|---|---|
| **Playwright + Claude** | **92%** |
| Browserbase | 90% |
| Stagehand | 89% |
| Anthropic Computer Use (vision) | 78% |
| OpenAI CUA | 75% |

**Verdict: Playwright, via the daemon, as registry capabilities.** Reasons: (a) it's already in your
repo for e2e; (b) DOM/network/page-state access beats pixels — *"far less prone to visual
misidentification"*; (c) Playwright CLI (early 2026) writes compact YAML snapshots to disk instead
of streaming accessibility trees into context — **~4× fewer tokens**, which matters given
`MAX_TOOL_OUTPUT_CHARS = 2000`.

**Reject vision-based computer use for now.** 78% reliability on a capability that can click
"delete" is not a product; it's a liability. Revisit when it clears ~90%.

**Note for Lane C:** this is where Limit 1 and Limit 2 bite simultaneously. A Playwright capability
blows the 10s timeout, exceeds the 2000-char output cap, and dies when the tab closes. **The daemon
cannot ship usefully until Stages 1–2 land.** That is the most actionable sequencing fact in this
report.

## 2.7 Self-improving systems — verdict: **ADOPT-LATER (GEPA), and it's the prize**

**GEPA** (Genetic-Pareto, in DSPy) is the standout: reflective prompt evolution. Instead of
collapsing feedback into a scalar reward, it *reads* error messages and traces in natural language,
diagnoses why a prompt failed, and proposes targeted fixes. ICLR 2026 oral. Beats MIPROv2 by ~13%
and RL (GRPO) by ~20% **with 35× fewer rollouts**. Needs as few as **10 examples and 20–100
evaluations**. Nous Research's Hermes self-evolution runs on DSPy+GEPA and evolves prompts *and tool
descriptions*.

**This is literally what you asked for**: *"i will want this system to improve on itself — email
extractions, chats, genui."* GEPA is the mechanism. It's cheap, it's proven, and 10 examples is
within reach today.

**And you cannot run it yet.** GEPA optimizes against a metric. You have no metric on real data.
Feeding it a golden set that scores an `EchoToolExecutor` would optimize your prompts toward
mimicking an identity function.

> **This is the whole report in one paragraph.** The self-improvement engine you want is
> off-the-shelf, cheap, and needs 10 examples — you have thousands of free human labels in
> `entity_type_corrections`. The *only* missing piece is a scorer that runs on real data. Evals
> aren't a chore blocking the fun part. **Evals are the fuel intake of the self-improvement engine.**
> Without them GEPA is a car with no petrol, and every month you don't build them is a month the
> engine can't turn over.

**Sequencing:** GEPA's first target is the entity-type classifier prompt — same surface as the first
eval, because the eval *is* GEPA's objective function. Build it once, use it twice. Trigger in §3.

---

# 3. Must-answer: the complexity ceiling and the cheapest way to raise it

You asked: *at what point does the tool-loop-in-a-router shape break, and what's the cheapest
structural change that raises the ceiling without a rewrite?*

**It breaks at exactly four places**, and none require a rewrite:

| Dimension | Breaks at | Cheapest fix |
|---|---|---|
| **Long-horizon runs** | >90s, or tab close | §3.2 — decouple run from connection (~1 wk) |
| **Parallel agents** | 2 agents on one goal | Parent-run FK + spawn primitive (Stage 3) |
| **Resumability** | Any process restart | §3.2 gets 80%; DBOS for the rest |
| **Cost control** | ✅ **Not broken** | Already solved — genuinely ahead here |
| **Human-in-the-loop** | ✅ **Not broken** | Already solved at conversation layer |
| **Capability count** | ~6 by ergonomics, ~30 by tokens | §3.1 — the registry (~1 wk) |

## 3.1 Change A: the registry (D2's spine) — ~1 week

Collapse the two parallel dicts into one record. This is mostly mechanical:

```python
@dataclass(frozen=True)
class Capability:
    name: str
    description: str
    input_schema: dict[str, Any]      # JSON Schema — already exists, in server_tool_defs
    executor: ToolExecutor            # already exists, in tool_executors
    risk: Literal["read", "write", "destructive"]   # NEW — the permission axis
    budget: CapabilityBudget          # NEW — per-capability timeout/output cap (kills Limit 2)
    surfaces: frozenset[Literal["llm", "genui", "canvas", "daemon"]]  # NEW — D2's four readers
```

`container.py` builds `Mapping[str, Capability]`. `RunChatTurn` takes **one** param instead of two
(and future capabilities add **zero**). Then:
- **LLM** reads `{name, description, input_schema}` → tool offer (what `_build_tool_offer` does now)
- **genui** reads the same → composable blocks (D2 §2 — "genui composes primitives, not markup")
- **daemon** reads `executor` + `risk` → Lane C's ToolExecutor + ONE permission model
- **canvas** reads `surfaces` → node types

Four consumers, one source of truth. **This is D2 §1 verbatim, and it's a refactor, not an
invention** — you already have the data, split across two dicts and 18 constructor params.

Three design constraints you'd otherwise miss:
1. **`risk` must live on the capability, enforced by one interceptor in the loop** — never by each
   executor. Per-executor permission checks are how you get an inconsistent permission model, and
   D2 says *ONE*. This is the Lane C convergence point.
2. **Support search, not just enumeration** (§2.4). `_build_tool_offer` currently returns a tuple of
   every tool. At 30 capabilities on an 8K-context model that's fatal. Add a `search_capabilities`
   meta-tool + embeddings on descriptions. Cheap now; painful to retrofit after genui composes
   against a flat list.
3. **Keep the import-linter contract.** `Capability` goes in `app/domain/ports/`. The existing
   local-constant-redefinition dance (`_WEB_SEARCH_TOOL_NAME`) is a symptom of the registry's
   absence and largely dissolves once names live in one domain-layer place.

## 3.2 Change B: decouple run lifetime from connection lifetime — ~1 week ⚠️ **highest leverage**

**Today:** SSE stream *is* the run. Disconnect → `pending.cancel()` → agent dies.

**Change:** the run becomes a background task writing to `chat_run_events`. **SSE becomes a tail of
that table, not the run itself.**

```
POST /chat/stream  → spawn background run task → return 202 {run_id}
GET  /chat/runs/{run_id}/events?after_seq=N  → SSE tails chat_run_events by seq
```

Disconnect now cancels **the tail**, not the run. Reconnect with `after_seq` (or `Last-Event-ID`)
and you resume mid-run. Two browsers can watch one run. A run with no browser attached completes
fine — **which is the definition of an automation.**

**Why this is unreasonably cheap for what it unlocks:**
- `chat_run_events.seq` is **already** monotonic per run, **already** uniquely indexed on
  `(run_id, seq)`.
- The SSE frame **already** serializes `{"type", "seq", "data"}` — `seq` is already on the wire.
- The client **already** handles `seq`.
- `_execute_turn` **already** persists every event.

You built the entire substrate for resumable runs and then tied the run's life to a TCP socket. The
change is roughly: move the task spawn, add a tail endpoint, add `after_seq`. **~200 lines.**

This single change unlocks: long-horizon runs, desktop control, terminal commands, coding agents,
background automations, multi-device observation, and 80% of durable execution — **with no new
dependency, no new platform, and no framework.** It is the best value-per-line in this report.

*(Second-order: you must then decide when a detached run stops. Answer: the cost breaker you already
have, plus a wall-clock cap. You have the mechanism.)*

---

# 4. The five questions you don't know to ask

You said you can't steer in deep technical terms. These are the five where a wrong default is
expensive and the failure is silent. Each has my recommended default.

### 4.1 "What is my judge's agreement with me?"

**Why it matters:** the moment you can't score by exact match (chat quality, genui quality), you'll
reach for LLM-as-judge. It looks like it works instantly. It has documented systematic biases:
**position bias (~40% GPT-4 inconsistency), verbosity bias (~15% inflation), self-enhancement bias
(5–7%)**, and agreement drops 10–15% in specialized domains — *yours is specialized*. A judge that
agrees with you 60% of the time will confidently point your optimizer at the wrong hill, and you'll
be unable to tell the difference between "the model improved" and "the judge drifted."

**Default:** **Don't use an LLM judge for your first two evals.** Use `entity_type_corrections` —
free, human, unambiguous ground truth. When you eventually need a judge: label 100–300 real traces
yourself, require **Cohen's kappa > 0.6** judge-vs-you (>0.8 is strong), and **re-run that
calibration set monthly** to catch judge drift from provider updates. A judge you haven't calibrated
is a random number generator with good manners.

### 4.2 "What is my unit of replay?"

**Why it matters:** the question behind every offline eval is *"can I re-run yesterday's real turn
against today's code and diff the result?"* Without it you can only evaluate synthetic fixtures —
which is exactly how you ended up scoring an `EchoToolExecutor`. Teams that skip this are permanently
stuck testing what they imagined instead of what happened.

**Default:** make `chat_run_events` **replayable**. You're ~90% there: the event log has inputs,
tool calls, and outputs. Add a `replay(run_id)` that reconstructs `provider_messages` and re-runs
against current code with recorded tool results. Then every production turn becomes a potential test
case, for free, forever. **This is the highest-value thing nobody would ever put on a roadmap.**

### 4.3 "What does a successful task cost — not what does a token cost?"

**Why it matters:** you have a `chat_cost_ledger` — better than most. But it measures **tokens per
turn**, and the number that governs a business is **dollars per *successful outcome***. An agent
that costs $0.02/turn and needs 8 retries is worse than one costing $0.10 and needing one. Optimizing
token cost while blind to success rate is how teams cheerfully make their product cheaper and worse.
Replit's Mastra number is the shape of this metric: 80% → 96% *task success*.

**Default:** the moment §2.2's first eval exists, join it to `chat_cost_ledger` on `run_id` and
track **cost-per-success**. You already have both halves; nobody has joined them. Make it the one
number on the wall.

### 4.4 "How many capabilities until the tool schemas eat the context?"

**Why it matters:** covered in §2.4, but it belongs here because it's the question whose absence
would silently poison D2. Every capability is a 200–800 token permanent tax on every turn.
D2's vision is *dozens*. Your own `chat_model_registry.py` declares models at `context_tokens=8_192`.
The arithmetic breaks well before the ambition does — and it breaks *gradually*, as rising quality
degradation, not as an error. You'd blame the model.

**Default:** build search/progressive disclosure into the registry at Stage 1 (Anthropic's Tool
Search: **~85% token reduction**). Never ship a flat "here are all N tools" offer past ~10
capabilities.

### 4.5 "Who owns permission — the tool, or the loop?"

**Why it matters:** today, safety is distributed — each executor honours a quarantine contract, the
envelope gate sits at one wiring point, `emit_confirm_action` enforces reference-only privilege. It
works at 4 read-only tools. It **will not survive** `run_terminal_command`. If each capability
decides its own permissions, you get N permission models, and the one that's wrong is the one that
`rm -rf`s something. D2 says **ONE permission model**; Lane C is building it daemon-side *tonight*,
in a separate process, with no registry to read.

**Default:** **`risk` is a Capability field; enforcement is a single interceptor in the loop; the
daemon is a *consumer* of that decision, not a second authority.** Get this in front of Lane C
before their permission model sets — D2 explicitly flags the daemon's ToolExecutor and the registry
as *"the same abstraction seen from two sides"* that *"should converge, not diverge."* Two
authorities is the failure mode, and it's ~4 hours to prevent now versus a rewrite later.

---

# 5. Signup verdict — direct answer

> **No. Sign up for nothing tonight. Sign up for nothing this month.**

You asked whether you should sign up for another platform to build this internal AI system. The
answer is no, and it isn't frugality — it's that **every capability you need is either already in
your repo or self-hostable at $0**, and a hosted platform right now would buy you convenience on a
problem you don't have yet.

| Candidate | Verdict |
|---|---|
| **Langfuse Cloud** | ❌ No — **self-host it**. OSS, free, ClickHouse-backed (acquired Jan 2026), no per-seat. `docker compose up`. You already run Docker |
| **Braintrust** ($249/mo) | ⏸ Not now. Its edge is eval-CI gates; you have no evals to gate. Revisit at Stage 4 *if* eval-CI is the bottleneck |
| **LangSmith** | ❌ Never — LangChain-coupled, you have no LangChain |
| **Arize AX** | ❌ No — self-hosted Phoenix is the free equal |
| **Browserbase** | ❌ No — managed browser runtime; the daemon *is* your runtime, on your box |
| **Temporal Cloud** | ❌ No — §2.5. Your event log already does the hard part |
| **OpenAI / Anthropic direct** | ❌ No — you're on Bedrock via IAM role, no API keys. That's an asset (no key to leak); don't regress it |

**The single exception, and it isn't a signup:** allocate **~2GB of RAM on your box** for a
self-hosted Langfuse container. That's the entire infrastructure ask in this report.

**And one dependency discipline, stated as a rule:** the only new *runtime* dependency I'd take into
the agent path is `opentelemetry-sdk` — CNCF-graduated, vendor-neutral, massively scrutinized. Not
`langfuse-python`, not `dspy` (yet), not an agent framework. Langfuse receives OTLP over the wire and
never enters your import graph. **Your app should depend on the protocol, not the company.** That
keeps your standing supply-chain rule intact while still buying you the whole 2026 observability
ecosystem.

---

# 6. The staged path — today → sophisticated deep AI product

Each stage has a **trigger**, so you don't over-build now. **Do not skip a stage; each is the
previous one's prerequisite.**

---

### **Stage 0 — Measure what you already shipped** · trigger: **none, do it now** · ~1 week

*You are flying an aircraft with a full black box and no instruments.*

1. OTel spans: `_execute_turn` → `invoke_agent`; `ToolExecutor.execute` → `execute_tool`; token
   counts from the `UsageDelta` you already capture. Export OTLP → self-hosted Langfuse. **(~1 day)**
2. **First eval:** LEARN-02 lift — cold-start vs. correction-few-shot classification accuracy on
   held-out `entity_type_corrections`. **(~2 days)**
3. Fix or delete the echo-scoring golden set (`test_retrieval_golden_set.py`). It currently provides
   false assurance, which is worse than no assurance.
4. Wire an `evals` CI job. Unmeasured on every commit = unmeasured.

**Done when:** you can answer *"did the AI get better or worse this week?"* with a number.
**Why first:** every later stage's trigger is a number this stage creates. Stage 4 is impossible
without it.

---

### **Stage 1 — The capability registry (D2's spine)** · trigger: **Lane C lands, OR capability #6 — whichever first** · ~1 week

1. `tool_executors` + `server_tool_defs` → one `Capability` record (§3.1).
2. Add `risk` + per-capability `budget` (kills Limit 2's global constants).
3. **ONE permission interceptor in the loop.** Converge with Lane C *before* their model sets (§4.5).
4. Build `search_capabilities` / progressive disclosure now, not later (§4.4).
5. Break up `run_chat_turn.py` (2263 lines → CLAUDE.md's 800) — the registry makes this natural
   rather than heroic, because most of the mass is per-capability branching.

**Done when:** adding a capability touches **one file** and zero constructor signatures.
**Why here:** it's cheap, it's D2's invariant, and Lane C is building the other half *right now*.
Diverging is the expensive outcome.

---

### **Stage 2 — Decouple the run from the connection** · trigger: **first capability that takes >30s, or must survive a tab close** · ~1 week

That trigger fires the moment the daemon does anything real. §3.2: background run task; SSE tails
`chat_run_events` by `seq`; `after_seq` / `Last-Event-ID` resume.

**Done when:** you close the tab, reopen it, and the agent is still working.
**Why here:** unlocks desktop control, terminal, coding, and background automations *simultaneously*,
for ~200 lines and no new dependency. **This is the ceiling-raiser.**

---

### **Stage 3 — Long-horizon + parallel** · trigger: **a run must survive a process restart, OR >1 agent on one goal** · 2–4 weeks

1. Subagents with isolated context returning 1–2K-token summaries (`chat_runs` needs a parent FK;
   `agentId` already exists). This is the 2026 reliability consensus, not a luxury.
2. **Compaction** to replace `_trim_history_to_budget`'s truncation (summarize, don't drop).
3. Raise `_MAX_TOOL_ROUNDS` from 4 — behind Stage 1's per-capability budgets, never as a global.
4. **Only if the restart trigger genuinely fires:** evaluate DBOS (Postgres-only durability). Stage 2
   likely made this unnecessary — check before buying.

**Done when:** an agent completes a 50-step task, unattended, across a deploy.

---

### **Stage 4 — Self-improvement (the thing you actually asked for)** · trigger: **≥2 evals scoring real traffic, AND one has been red at least once** · ~2 weeks

The "has been red" clause is not pedantry. **An eval that has never failed is not known to work** —
it may be measuring nothing (which is exactly what your golden set does today). Optimizing against a
metric you haven't seen fail is how you confidently make the product worse.

1. DSPy + GEPA on the entity-type classifier prompt. Objective = Stage 0's eval. GEPA needs ~10
   examples / 20–100 evals; `entity_type_corrections` has thousands, free.
2. Then GEPA on **tool descriptions** — Hermes does exactly this, and it compounds: better tool
   descriptions → better tool selection → better everything downstream.
3. Then the genui + chat surfaces (these need a **calibrated** judge — §4.1 — so they come last).

**Done when:** a prompt improves without you editing it, and the eval proves it did.
**This is "the system improves on itself."** Note it's Stage 4, not Stage 0 — every earlier stage
exists to make this one possible.

---

### **Stage 5 — The self-building product (D2 realized)** · trigger: **registry ≥10 capabilities, permission enforced in one place**

genui specs *bind* to registry capabilities: a generated panel can query, mutate, and act — not just
render. D2 §2's distinction, exactly: *"the difference between 'a chart of my data' and 'a feature.'"*
The infrastructure is the limit, deliberately: you widen what's possible by writing a primitive in
code; the AI composes within it. Safety model and extension model, same mechanism.

**This stage is unreachable without Stage 1**, which is why the registry is the invariant and not a
feature.

---

## 7. What I'd tell you if you only had 60 seconds

1. **Your architecture is sound. Don't rewrite it. Don't adopt a framework.** Your loop, your cost
   breaker, and your injection quarantine are better than what most 2026 teams have. This is the
   "or nothing" answer, and it's the honest one.
2. **You shipped a learning loop in Phase 57 and nobody knows if it works.** That's the bug. Fix it
   with a 2-day eval against human corrections you already have and aren't using.
3. **One line — `pending.cancel()` on disconnect — is the ceiling on everything you asked for.**
   ~200 lines to fix, no new dependency, and it unlocks desktop/terminal/coding/automation at once.
4. **Your two hand-wired tool dicts are D2's registry with the wrong name.** Zip them into one
   record, add `risk` + `budget`, before Lane C's permission model sets in a different shape.
5. **Sign up for nothing.** Self-host Langfuse; instrument with vendor-neutral OTel. The only ask is
   2GB of RAM.
6. **The self-improvement engine (GEPA) is off-the-shelf, cheap, needs 10 examples, and is blocked
   solely on having a metric.** Evals aren't the chore before the fun part. They're the fuel intake.

---

## Appendix A — Claim provenance

Every claim about this repo, with its file:line, so you can check me.

| Claim | Evidence |
|---|---|
| Agent is Python/FastAPI, not tRPC | `apps/email-listener/app/application/use_cases/run_chat_turn.py`; `apps/email-listener/app/presentation/api/v1/chat_stream.py` |
| `apps/daemon` does not exist | `ls apps/` → `email-listener/`, `web/` only |
| Run dies on client disconnect | `chat_stream.py:131-164` `stream_run_events` → `pending.cancel()` |
| `_MAX_TOOL_ROUNDS = 4` | `run_chat_turn.py:185` |
| 10s tool timeout | `run_chat_turn.py:188` |
| 2000-char tool output cap | `domain/ports/tool_executor.py:29` |
| 5 parallel calls/round | `run_chat_turn_tool_loop.py:51` |
| `RunChatTurn.__init__` has 18 params | `run_chat_turn.py:357-377` |
| `run_chat_turn.py` = 2263 lines (CLAUDE.md max 800) | `wc -l` |
| Two parallel tool dicts, hand-maintained | `container.py:918-940` |
| Zero observability deps | `grep -rn "opentelemetry\|langfuse\|braintrust\|arize\|phoenix\|langsmith" pyproject.toml package.json` → ∅ |
| Golden set scores an echo | `tests/evals/test_retrieval_golden_set.py:1-12` docstring + `EchoToolExecutor` import |
| TS scorers orphaned | `grep -rn "scoreRetrievalAtK\|scoreInjectionResistance"` → only `eval/` + its own tests; app imports only `PAGE_IDEAS` (`page-ideas-island.tsx:45`) |
| Live harness never runs in CI | `test_live_injection_harness.py:99` `skipif(not _bedrock_credentials_available())` |
| No eval CI job | `grep -rn "eval" .github/workflows/*.yml` → ∅ |
| LEARN-02 loop exists, unmeasured | `suggest_entity_types.py:14-21`, `:126`; `entity_type_correction_repository.py:28` (`match_entity_type_corrections_by_trgm`) |
| `chat_run_events` is an event log | `packages/db/src/schema/chat-run-events.ts` — `runId` + `seq` + `type` + `data`, `uniqueIndex("idx_chat_run_events_run_seq")` |
| `seq` already on the SSE wire | `chat_stream.py:125-128` `_format_sse_event` |
| Capability-metadata precedent | `domain/services/chat_model_registry.py:37-48` `ChatModelCapabilities` |
| Small-context models in registry | `chat_model_registry.py:105,115,135` — `context_tokens=8_192 / 32_000 / 64_000` |
| Cost breaker + ledger | `run_chat_turn.py:1527` `_estimated_cost_so_far`; `schema/chat-cost-ledger.ts` |
| Injection quarantine contract | `domain/ports/tool_executor.py:12-18, 45-51` |
| Reference-only privilege model | `infrastructure/llm/chat_tools.py:267-295` |
| Truncation, not compaction | `run_chat_turn.py:2232` `_trim_history_to_budget` |
| One agent by design | `run_chat_turn.py:156-157` `_AGENT_ID`, "SEAM-04: one agent, one run per turn today" |
| Import-linter boundary | `run_chat_turn.py:159-165`; `chat_tools.py:27-33` |

**Confidence:** Repo claims **HIGH** (read directly, cited above). Field claims **MEDIUM** — web
search, mid-2026, cross-checked across sources where possible; benchmark percentages come from
vendor-adjacent blogs and should be treated as directional, not precise. **Not verified in this
session:** exact Langfuse self-host resource requirements; DBOS's current Python maturity; whether
OTel GenAI semconv attributes have stabilized since the 1.41 snapshot referenced below.

## Appendix B — Sources

- [OpenTelemetry GenAI spans (semantic-conventions repo)](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md)
- [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)
- [OpenTelemetry GenAI Agent SemConv Cheat Sheet 2026](https://techbytes.app/posts/opentelemetry-genai-agent-semconv-cheat-sheet-2026/)
- [How OpenTelemetry Traces LLM Calls, Agent Reasoning, and MCP Tools — Greptime](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions)
- [Langfuse alternatives compared 2026 — Braintrust](https://www.braintrust.dev/articles/langfuse-alternatives-2026)
- [LLM Observability Pricing: Braintrust vs Phoenix vs Langfuse](https://aibizhub.io/articles/llm-observability-pricing-braintrust-vs-phoenix-vs-langfuse-2026/)
- [Top 5 LLM and Agent Observability Tools in 2026 — MLflow](https://mlflow.org/top-5-agent-observability-tools/)
- [Durable Execution: How Temporal, Restate, and DBOS Are Rethinking Distributed State](https://devstarsj.github.io/2026/04/03/durable-execution-temporal-restate-dbos-distributed-workflows-2026/)
- [Durable Execution Patterns for AI Agents — Zylos Research](https://zylos.ai/research/2026-02-17-durable-execution-ai-agents)
- [Choosing an agent framework — Speakeasy](https://www.speakeasy.com/blog/ai-agent-framework-comparison/)
- [Best open source agent frameworks 2026 — Firecrawl](https://www.firecrawl.dev/blog/best-open-source-agent-frameworks)
- [AI SDK 6 — Vercel](https://vercel.com/blog/ai-sdk-6)
- [MCP spec: tool schema token overhead (~1000 tokens/tool) — Issue #2808](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/2808)
- [MCP Context Bloat Fix 2026: Tool Search, Code Mode, Progressive Disclosure](https://mcp.directory/blog/mcp-context-bloat-fix-2026-tool-search-code-mode-progressive-disclosure)
- [Everything your team needs to know about MCP in 2026 — WorkOS](https://workos.com/blog/everything-your-team-needs-to-know-about-mcp-in-2026)
- [MCP-Zero: Active Tool Discovery for Autonomous LLM Agents (arXiv)](https://arxiv.org/pdf/2506.01056)
- [GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning (arXiv)](https://arxiv.org/pdf/2507.19457)
- [Reflective Prompt Evolution with GEPA — DSPy docs](https://dspy.ai/tutorials/gepa_ai_program/)
- [gepa-ai/gepa — GitHub](https://github.com/gepa-ai/gepa)
- [Hermes Agent Self-Evolution (Nous Research) — BrightCoding](https://www.blog.brightcoding.dev/2026/06/22/stop-writing-prompts-manually-hermes-agent-self-evolution-does-it-for-2)
- [Computer Use Agents in 2026: Claude, Operator, Stagehand & 5 More Compared](https://jobsbyculture.com/blog/computer-use-agents-guide-2026)
- [AI browser automation token benchmark 2026 — ytyng](https://www.ytyng.com/en/blog/ai-browser-automation-tools-comparison-2026)
- [Context Engineering: Agent Reliability Playbook 2026](https://www.digitalapplied.com/blog/context-engineering-agent-reliability-playbook-2026)
- [Context Engineering: A Practical Guide for AI Agents — Sourcegraph](https://sourcegraph.com/blog/context-engineering)
- [How to Calibrate LLM-as-Judge with Human Corrections — LangChain](https://www.langchain.com/resources/llm-as-a-judge)
- [Reliability without Validity: Large-Scale Evaluation of LLM-as-a-Judge (arXiv)](https://arxiv.org/pdf/2606.19544)
- [LLM as a Judge: A 2026 Guide — Label Your Data](https://labelyourdata.com/articles/llm-as-a-judge)
</content>
</invoke>
