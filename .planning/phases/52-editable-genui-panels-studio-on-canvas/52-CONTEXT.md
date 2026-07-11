# Phase 52: Editable Genui Panels / Studio-on-Canvas - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning
**Mode:** Overnight autonomous run — grey-area answers are the recommended defaults,
auto-accepted per the user's explicit "finish all milestones autonomously" directive.

<domain>
## Phase Boundary

Canvas genui panels become live editing surfaces: per-panel style-pack switching that
persists (PANL-01), bounded schema-validated spec-parameter editing (PANL-02), in-place
regeneration with provenance + reachable prior versions (PANL-03), and a natural-language
re-theme instruction that resolves to pack/token choices generation-side (PANL-04 — no
visual-compare repair loop).

Out of scope: DSGN-02 rendered-visual-compare repair, DSGN-04 screenshot→token extraction
(v2 requirements), multi-panel bulk operations, any mobile behavior (Phase 53).

</domain>

<decisions>
## Implementation Decisions

### Editing Surface & Controls (PANL-01/02)
- Per-panel controls live in the existing canvas panel node chrome (a compact toolbar on
  the node: pack switcher, edit, regenerate, history) — extend the existing node component,
  do not introduce a separate inspector page
- The pack switcher is a dropdown listing the registered style packs from the Phase-48
  token machinery (the 6 packs); switching applies immediately and persists
- The parameter editor is a bounded, schema-driven form (Zod on the client AND the same
  server-side untrusted-input gate as FOUND-6) — only whitelisted spec parameters are
  editable; free-form JSON editing is NOT offered
- Persistence rides the existing panel/spec storage the canvas already uses (canvas layout
  + genui spec records); reload must rehydrate the edited state

### Provenance & Versioning (PANL-03)
- Supersede-never-mutate (consistent with the project's entity-resolution stance):
  regeneration writes a NEW spec version linked to its predecessor; the prior version stays
  reachable from the panel's history control
- Provenance fields record: generated_by (regenerate|retheme|edit), parent version ref,
  the instruction/params used, and timestamp
- History UI is minimal: a small list of prior versions with restore — no diff view

### NL Re-theme Slice (PANL-04)
- Generation-side only: instruction + current spec → LLM (existing Bedrock transport)
  resolves to {style_pack_id, token-level overrides within the pack's allowed set};
  output is schema-validated before application; invalid → friendly error, no partial apply
- One-shot resolution — explicitly NO repair loop, NO screenshot judging (that is DSGN-02,
  deferred)
- The re-theme result is applied via the same versioning path as PANL-03 (provenance
  mechanism: retheme)

### Verification (environment-constrained tonight)
- Docker/WSL is down this session: verification is vitest component/unit tests +
  typecheck + schema-gate tests; a live-canvas confirmation item is appended to
  MORNING-CHECKLIST.md §G rather than faked

### Claude's Discretion
- Exact spec-parameter whitelist; toolbar iconography (lucide, consistent with 51);
  where version rows live (new table vs existing events table) — planner researches the
  existing schema and picks the minimal-migration path (prefer NO new migration if the
  existing tables can carry versions; if a migration is unavoidable, it must be applied
  local-only tonight and queued for staging/prod in the morning flow)
- Whether to fix the known genui tabs-renderer stub (TabsComponent at
  packages/genui .. manifest.ts:684 renders only the tab's value word — Phase-19
  renderNode wiring never landed). It sits squarely in this phase's feature area; fix it
  if plans touch the renderer wiring anyway, else log as explicit deferred item.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase-48 style-pack/token machinery (TOKEN_ALIASES, packs, spacing.density scalar)
- Canvas panels-as-nodes architecture (v1.3 Phase 23), chat-canvas.tsx + node registry
- genui spec pipeline: generation events table (0021), style packs, genui renderer
  (packages/genui) with jailed code-island architecture
- FOUND-6 untrusted-input gate (schema-validated spec boundary) — reuse, do not fork
- Bedrock LLM transport (no direct Anthropic API)
- 51-06's invalidateOnChatTerminal pattern for cache invalidation after mutations

### Established Patterns
- Supersede-never-mutate versioning (entity resolution); suggest-only gates
- tRPC routers in apps/web for canvas/chat/knowledge mutations
- Zod at every boundary; typecheck after changes; targeted vitest runs

### Integration Points
- Canvas node chrome (chat/_canvas/*) — where the per-panel toolbar mounts
- genui spec storage + generation events (packages/db schema 0021-0025)
- Style-pack registry (packages/ui or token source) — pack list for the switcher

</code_context>

<specifics>
## Specific Ideas

- "Studio-on-Canvas": the studio's editing powers come TO the canvas panel — the studio
  page itself is unchanged this phase
- Depth-first: one panel fully editable end-to-end beats four half-wired controls

</specifics>

<deferred>
## Deferred Ideas

- DSGN-02 visual-compare repair loop; DSGN-04 token extraction (v2)
- Bulk multi-panel operations; diff view in version history
- Live-canvas E2E evidence → MORNING-CHECKLIST.md §G queue (Docker down tonight)

</deferred>
