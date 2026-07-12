# Phase 54: Email-Cluster Workflow (E3) - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning
**Mode:** Overnight autonomous run — grey-area answers are the recommended defaults,
auto-accepted per the user's explicit "finish all milestones autonomously" directive.

<domain>
## Phase Boundary

The killer feature, depth-first: email-thread clusters with attached chats, mid-turn web
research, and promotable knowledge (CLUS-01..06 built and code-verified tonight; CLUS-07 —
the live acceptance scenario on the user's real inbox — is USER-executed in the morning
flow and is the milestone's acceptance bar).

Depth-first mandate (REQUIREMENTS.md Out of Scope): ONE scenario fully working beats five
half-working. No multi-cluster management, no cluster UI polish beyond the scenario, no
PDF/attachment capture pipelines.

</domain>

<decisions>
## Implementation Decisions

### Thread cards on canvas (CLUS-01)
- New first-class canvas node type via the existing versioned node-type registry (the
  CANVAS-03 seam), kind `email_thread`
- Card shows the thread's REAL subject, participants, and a summary (latest-message
  preview or stored summary) fetched via tRPC from the threads/emails tables
- Placement affordance: an "Add thread" action on the canvas (thread picker listing the
  user's threads); an inbox-side "send to canvas" affordance only if trivially cheap

### Thread ↔ chat linkage (CLUS-02)
- Durable server-side linkage: migration 0036 adds nullable
  `chat_conversations.thread_id uuid REFERENCES threads(id) ON DELETE SET NULL` + index —
  additive-only, mirrors emails.thread_id. Canvas sharedState is NOT the linkage store
  (linkage must survive canvas changes and be readable at turn time server-side)
- MIGRATION DISCIPLINE tonight: Docker is down → 0036 is AUTHORED + schema-typed +
  unit-tested (mocks) tonight but applied NOWHERE. The morning flow applies it
  local → staging → prod (Management API path proven) BEFORE the CLUS-07 live scenario.
  Server code must fail gracefully (feature detection / clean errors) if the column is
  absent
- Attaching a chat: from a thread card on the canvas ("Attach chat") which creates/links a
  conversation with thread_id set; the chat header shows the linked thread
- At turn time, when conversation.thread_id is set, the agent's context assembly injects a
  BOUNDED thread context block (subject, participants, recent message bodies up to a token
  budget) — quarantine discipline: email content is untrusted input, enveloped exactly
  like v1.6 tool results

### web_search ToolExecutor (CLUS-03)
- FastAPI-side ToolExecutor behind the SAME port/allowlist/envelope-quarantine/
  adversarial-fixture discipline as the v1.6 thin-wrapper tools
- Provider behind a SearchProvider port; DEFAULT = keyless provider (DuckDuckGo
  lite/html endpoint via httpx) since no search API keys exist in any env file; swapping in
  a keyed provider (Tavily/Brave) is a documented morning option, not a blocker
- Fetch pipeline: search → top-N results → fetch pages (https only, public hosts only —
  SSRF guard rejects private/loopback/link-local IPs and non-http(s) schemes) → strip to
  bounded text → quarantine envelope
- Exposure is CODE-GATED: the tool is registered/exposed only when the adversarial fixture
  suite passes (a flag/gate in code, not vibes) — same pattern as v1.6
- Adversarial fixtures: prompt-injection payloads inside fetched pages must remain inert
  (quarantined, never executed as instructions)

### Source capture as INFERRED nodes (CLUS-04)
- Suggest-only: after a web_search tool round, the agent may propose captures; the user
  confirms via the existing confirm-action widget machinery (v1.6) — nothing writes
  without confirmation
- On confirm: INFERRED-tier knowledge node per source with provenance
  {url, title, retrieved_at, conversation_id, thread_id} and an edge attaching it to the
  cluster; supersede-never-mutate

### Promotion (CLUS-05)
- Reuse the existing suggest-only promotion gate exactly as-is (confirm-action widgets,
  INFERRED→EXTRACTED promote endpoint, provenance retained). No new promotion machinery

### Cluster context accumulation (CLUS-06)
- A cluster = a thread + all conversations with that thread_id + their captured sources
  (knowledge nodes) + their genui panels
- Subsequent chats attached to the same thread get a bounded "cluster context" block:
  sibling conversation titles/summaries, captured source titles+URLs, genui panel titles —
  metadata-first, full content only within budget
- Cache invalidation follows the 51-06 invalidateOnChatTerminal pattern

### CLUS-07 (user-live acceptance)
- Appended to the morning flow as §H: the full scenario on the real inbox (real thread →
  attach chat → web research with thread in context → capture sources → promote → new chat
  sees cluster context). Depends on §A-§G items (OAuth, forwarding, Docker recovery,
  migration 0036 chain). NOT executable tonight; never faked

### Verification (environment-constrained tonight)
- pytest with mocked search provider + mocked Bedrock (adversarial fixtures run for real —
  they are pure-Python); vitest with mocked tRPC for all UI; typecheck; committed gates.
  Live round-trips queued to §H

### Claude's Discretion
- Thread summary derivation (latest preview vs LLM summary — prefer cheap/latest-preview
  tonight); exact context-budget numbers; node-type registry versioning details; where the
  SearchProvider port lives in the FastAPI hexagonal layout

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- threads + forwarding tables (0035); emails.thread_id; thread grouping UI (45)
- v1.6 tool discipline: thin-wrapper ToolExecutors, allowlist, envelope quarantine,
  adversarial fixtures, code-gated exposure (Phases 36-38); search_knowledge tool
- Confirm-action widgets (Phase 40) + suggest-only promotion gate (Phase 30/40)
- Versioned canvas node-type registry (CANVAS-03 seam, v1.3) + knowledge-preview-node
  (Phase 41) as the closest node-type analog
- Chat context assembly in run_chat_turn tool loop (apps/email-listener)
- 51-06 invalidateOnChatTerminal; 52 panel machinery (genui panels in clusters)
- Bedrock transport; httpx already a dependency in the listener

### Established Patterns
- Hexagonal FastAPI: domain ports / application use cases / infrastructure adapters / DI
  container; TDD RED→GREEN; ruff+mypy+pytest gates (coverage floor 80 — new code must be
  well-covered; the repo-wide number is 68 and must move UP)
- Drizzle migrations at packages/db/migrations; journal via meta/_journal.json
- tRPC protectedProcedure + ownership helpers (44) for user-scoped reads

### Integration Points
- packages/db (schema + 0036 migration authoring)
- apps/email-listener tool registry + run_chat_turn context assembly
- apps/web chat canvas node registry + inbox thread UI
- knowledge_nodes/knowledge_node_edges (INFERRED capture + promotion)

</code_context>

<specifics>
## Specific Ideas

- The ONE scenario (CLUS-07 text) is the acceptance bar — every build decision optimizes
  for that scenario working live in the morning, not for feature breadth
- Email content and web content are BOTH untrusted: the quarantine envelope discipline
  applies to thread-context injection exactly as to tool results

</specifics>

<deferred>
## Deferred Ideas

- Multi-cluster management, cluster UI polish, PDF/attachment capture (explicit Out of
  Scope); keyed search provider swap (morning option); LLM-generated thread summaries
- Live application of migration 0036 + live round-trips → morning §H

</deferred>
