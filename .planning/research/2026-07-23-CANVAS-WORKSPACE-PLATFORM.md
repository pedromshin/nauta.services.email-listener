# Canvas / Workspace platform — staged design + use cases

> Status: DESIGN, staged 2026-07-23 from Pedro's product direction (mobile message).
> Grounding: everything here builds on what ALREADY EXISTS — the chat canvas
> (`apps/web/src/app/chat/_canvas`, 13 registered node types, edges, per-conversation
> persistence in `chat_canvas_layouts`), genui (`packages/genui`), drive (`/files`),
> knowledge graph, and the FastAPI listener's chat/agent runtime. This is a
> promotion-and-generalization plan, not a greenfield build.

## 1. The vision, distilled

Pedro (on mobile) wants to:

1. Create **workspaces** (e.g. "personal"), each holding **canvases**, each holding
   **nodes** — all persistent, all usable from a phone.
2. Create a node by **telling the AI what data it should be** ("all emails that
   billed, charged or confirmed a payment") — the agent figures out the right SQL/
   retrieval, builds the node, and renders it via genui (table, circular treemap,
   dataviz, …). Same for drive files.
3. **Wire nodes into a chat node** as context. Chat can **create files**, saved into
   an existing node's location or a new directory + drive node.
4. Generation must be **server-side and persistent** — many nodes generating at
   once, surviving a dead phone battery mid-run.

## 2. Current state → gap analysis

| Capability | Today | Gap |
|---|---|---|
| Canvas + nodes | Exists on `/chat` per conversation (xyflow; chat, genui-panel, knowledge-preview, email-thread, document, source, directory, browser, desktop, editor, spreadsheet, file, circle-pack nodes) | Canvas is a *child of a conversation*. Needs to be first-class: workspace → canvas → nodes, with conversations attachable |
| Node ↔ chat context | `chat_context_edges` exists (email threads as chat context shipped) | Generalize: any node type can be an edge source into a chat node |
| Genui rendering | `packages/genui` component registry + retrieval | No "**data node**": a stored, refreshable query whose *result* renders via genui |
| Background work | Chat streams live to the client; widget interactions persisted | No durable server-side job runner: generation dies with the socket |
| Drive | `/files` + spreadsheets schema + daemon fs capabilities | Chat can't yet *write* files into drive; no "save output as file → node" |
| Mobile | Pages responsive; canvas untested on touch | Touch canvas UX (pinch/pan, node creation sheet) |

## 3. Data model (packages/db — additive migrations)

```
workspaces        id, user_id, name, created_at
canvases          id, workspace_id, name, is_default, created_at
canvas_nodes      id, canvas_id, type, position, data(jsonb), spec_id?, job_id?
canvas_edges      id, canvas_id, source_node_id, target_node_id, kind ('context'|'data')
data_node_specs   id, user_id, prompt, compiled_query(jsonb), renderer('table'|'circle-pack'|'chart'|...),
                  refresh_policy, last_built_at
node_jobs         id, user_id, node_id?, conversation_id?, kind('build_data_node'|'chat_turn'|'file_generate'),
                  status('queued'|'running'|'done'|'failed'), progress(jsonb), result_ref, error,
                  started_at, heartbeat_at, finished_at
```

- `chat_canvas_layouts` migrates: each conversation's canvas becomes a `canvas` in an
  auto-created "personal" workspace; the snapshot reconciler already tolerates this
  (unknown-type degrade, exact-position restore).
- Tenancy: every table carries/derives `user_id`; same TENA-03 ownership-assert
  pattern at every tRPC boundary. RLS mirrors the rest of the schema.

## 4. The AI data node (the heart of it)

A **data node** = *prompt → compiled retrieval spec → materialized result → genui render*.

Build pipeline (listener-side, as a `node_jobs` job):
1. **Compile**: agent turns the user prompt into a typed retrieval spec — SQL over the
   owned schema (emails, attachments, entities, drive files, spreadsheet cells) plus
   semantic filters. The spec is *stored*, not just the result — nodes are refreshable
   and auditable ("show me the query").
2. **Recall pass** (no false negatives): run WIDE — keyword + sender heuristics +
   embedding similarity + entity-type filters, union the candidates.
3. **Precision pass** (no false positives): LLM verifier classifies each candidate
   against the prompt ("is this actually a billing/charge/payment-confirmation
   email?") with a strict rubric; borderline → flagged for review, never silently
   dropped or included.
4. **Dedup/identity**: group repeats of the same underlying thing (same invoice
   re-sent, reminder chains) using the existing thread/body-identity services
   (`email_body_identity.py`) + entity resolution. The node shows *things*, with
   occurrences expandable.
5. **Extract**: per-group, pull the fields that matter for the prompt (amount,
   currency, vendor, due date, paid/confirmed status) via the existing extraction
   pipeline; store as the node's tabular result.
6. **Render**: result + prompt → genui spec (table by default; treemap/chart on
   request or when the agent judges it fitter). The renderer choice is part of the
   node spec and re-pickable without re-querying.

Drive-file nodes are the same pipeline with a different corpus (file metadata +
extracted content), and spreadsheet nodes are a data node whose result is bound to a
stored spreadsheet file.

## 5. Persistent background generation

- **Jobs live in the listener** (it's already the long-running Python service):
  a `node_jobs` table + a worker loop (asyncio task group polling `queued`,
  heartbeating `running`). ECS keeps it alive; no new infra.
- **Chat turns become jobs too**: the web's `/api/chat/stream` enqueues + streams;
  if the client disconnects, the job *keeps running* and persists parts to
  `chat_messages` exactly as it already persists completed turns. Reconnect = replay
  from the persisted parts + resume live tail (cursor on message-part sequence).
- **Client model**: nodes render their job status (queued/running/progress/done) from
  polling or Supabase realtime on `node_jobs`. Phone dies → reopen → everything is
  where the server got to. N nodes generating concurrently is just N job rows.

## 6. Chat ↔ nodes ↔ files

- **Context wiring**: connecting node → chat node writes a `canvas_edges(kind:
  'context')` row; at turn time the listener resolves each source node to a bounded
  context pack (data node → its result table + spec; drive node → file summaries;
  knowledge node → subgraph). Existing `chat_context_edges` (email threads) folds
  into this as the first node kind.
- **File creation**: a listener tool (`create_file`) writes to Supabase storage under
  the user's drive, registers it in the files/spreadsheets schema, and (when invoked
  from a canvas chat) drops a file/spreadsheet node wired back to the chat.
  Destination choice: an existing directory node, or "new directory" → creates
  directory + node. xlsx generation uses a Python engine (openpyxl) in the listener.

## 7. Mobile canvas UX

- Bottom-tab "Canvas" surface: workspace switcher → canvas list → canvas.
- Touch: pinch-zoom/pan (xyflow supports), long-press or FAB "+" → bottom sheet with
  node types; "describe your node" input (the AI-build path) is the default tab.
- Node cards render compact on phone; tap → full-screen node view (same component,
  bigger frame). Reuse the inbox-refactor overlay/sheet pattern.

## 8. Build order (each phase shippable alone)

1. **P1 — Workspaces/canvases first-class** (schema + tRPC + canvas page decoupled
   from conversation; migrate per-conversation layouts). Default "personal"
   workspace + blank canvas per user.
2. **P2 — Job runner + persistent chat turns** (node_jobs, listener worker,
   disconnect-safe streaming). This also fixes "phone dies mid-chat".
3. **P3 — AI data nodes for emails** (compile→recall→verify→dedup→extract→render;
   the billing use case is the acceptance test).
4. **P4 — Node→chat context generalization + chat file creation** (edges resolve at
   turn time; create_file tool; spreadsheet nodes from created files).
5. **P5 — Drive-file data nodes + genui render variety** (treemap/chart renderers,
   re-render without re-query).
6. **P6 — Mobile canvas polish** (touch, sheets, FAB, offline-tolerant status).

## 9. Use cases & user stories

**The anchor (Pedro, personal finance)** — P3+P4 acceptance:
billing-emails data node (complete, deduped, extracted) → chat node wired to it +
uploaded finance folder (xlsx et al.) → "merge my existing sheets with what the
emails say; produce one current-state xlsx" → new spreadsheet node → genui chart
nodes (spend over time, by vendor) → research nodes ("cheaper alternatives to X").

**Individuals**
- *Subscription auditor*: recurring-charge node auto-flags price increases, unused
  trials converting, duplicate services; research node proposes alternatives.
- *Tax/receipts season*: "every receipt/invoice from 2026" node → export directory
  of PDFs + one ledger xlsx for the accountant.
- *Travel binder*: bookings/itineraries node per trip; canvas is the trip dashboard.
- *Job search*: applications node (status extracted from replies) + prep-notes chat.
- *Warranty & purchases vault*: big-ticket purchase emails + receipts, queryable when
  something breaks.

**Teams**
- *AP inbox*: shared invoices node with dedup + amount/due extraction → approval
  chat → reconciled xlsx; the finance use case, multiplayer.
- *Sales pipeline from email*: prospect-thread nodes, stage extracted from replies,
  canvas as a live deal board fed by real correspondence.
- *Recruiting*: candidate nodes from application emails + CV attachments; interview
  chat wired to candidate context.
- *Support triage*: complaint/issue node with clustering ("same bug reported 12×"),
  wired to a drafting chat.

**Enterprise**
- *Vendor management*: per-vendor canvas — contracts (drive), invoices (email),
  renewal dates extracted; alerts as scheduled node refreshes.
- *Compliance/audit trail*: data nodes are *stored queries with provenance* — an
  auditor-readable "how was this list produced" answer, which ad-hoc AI chat can't
  give. This is the enterprise wedge.
- *Finance ops close*: monthly close canvas re-run from refresh policies; deltas
  highlighted between runs.

**Why it's a product**: the durable asset isn't the chat — it's the *node spec*
(a reusable, refreshable, auditable query over your own data) and the *canvas*
(a live dashboard assembled by prompting). Individuals: prosumer subscription.
Teams: shared workspaces + roles. Enterprise: provenance, refresh policies, SSO,
retention. Pricing follows compute (node builds/refreshes) — aligned with cost.

## 10. Risks / open decisions

- **Recall guarantee** (P3): "without missing any" needs the wide-recall + verify
  design AND a visible "N candidates reviewed, M matched, K borderline" trace —
  trust is the feature. Never ship a silent classifier.
- **Job runner on ECS**: single-container worker is fine now; if node builds get
  heavy, split a worker service later (same image, different command).
- **Context packs must stay bounded** (token cost): per-node caps + summarize-then-
  link, reusing the chat source-ledger pattern.
- **Realtime**: start with polling (simple, works through ALB); Supabase realtime is
  a drop-in upgrade on the web side only.
