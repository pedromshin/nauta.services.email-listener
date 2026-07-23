# Polytoken — User Stories

> Narrative user stories for every surface Pedro described in
> `.planning/prompts/2026-07-22-vision-and-handoff.md`, grounded in the feature IDs from
> `.planning/research/2026-07-22-FEATURE-CATALOG.md`. Each story maps to the catalog IDs
> (`AI-*` integration spine, `CV-*` canvas, `CI-*` canvas interactivity, `TM-*` treemap,
> `CH-*` chat, `DR-*` drive, `HM-*` home, `EN-*` entities, `ST-*` settings, `KN-*` knowledge,
> `DX-*` distributed inference / remote desktop) that satisfy it.
>
> **Purpose:** this feeds per-wave manual runsheets. Each story is a testable slice — the
> acceptance criteria are the observable behaviors Pedro will manually verify. Personas below
> are all facets of the same solo builder today, but named to keep multi-user stories honest.
>
> **Personas**
> - **Operator** — Pedro running his own mail/knowledge/drive daily (the primary user).
> - **Curator** — the same person correcting/steering the AI's analysis and entity graph.
> - **Builder** — arranging canvas/home boards and composing agent workflows.
> - **Host** — a user contributing idle compute / an LLM to earn credits.
> - **Consumer** — a user spending credits on heavier models than their hardware allows.
> - **Admin** — an org/workspace owner managing members, sharing, and permissions.
> - **Member** — a teammate with scoped access to shared surfaces.

---

## Surface 1 — Email Triage & Ingestion

### S1.1 — Automatic inbound ingestion
As the **Operator** I want every email that arrives to be ingested and analyzed automatically so that I never have to trigger processing by hand and my inbox becomes structured data the moment it lands.
- **AC1** A new inbound email appears in the app within minutes of delivery, with no manual import step.
- **AC2** Each email shows a per-stage analysis status (received → segmented → extracted → embedded → entity-resolved), not just "done."
- **AC3** Entity resolution and knowledge-edge proposals run as part of ingest, not only on a later user action.
- **AC4** Edges/entities created at ingest land at the "suggested" tier and never auto-promote to canon.
- **Satisfied by:** AI-03, ST-04

### S1.2 — Pipeline health visibility
As the **Operator** I want a single panel showing how many emails were received, fully analyzed, and failed (and at which stage) so that silent pipeline failures become visible instead of vanishing into swallowed exceptions.
- **AC1** A health surface reports counts: N received / M fully analyzed / K failed at stage X.
- **AC2** Each failed email is retryable from the panel, and a retry re-runs only the failed stages.
- **AC3** A degraded LLM adapter (segmentation/classification) surfaces as a visible warning, not a silent fallback.
- **AC4** Stage status persists per email so history is inspectable after the fact.
- **Satisfied by:** ST-04, AI-03

### S1.3 — Reprocess up to a date
As the **Curator** I want to reprocess all emails up to a chosen date so that a model or prompt improvement can be applied retroactively across my whole history.
- **AC1** I can select a cutoff date and trigger a bulk reprocess.
- **AC2** Reprocessing supersedes prior analysis deterministically (no orphaned/duplicate regions).
- **AC3** I see progress and a completion summary ("reprocessed N emails").
- **AC4** Corrections I previously made are respected or clearly flagged where re-analysis conflicts.
- **Satisfied by:** EN-04, ST-04, AI-03

### S1.4 — Correct AI analysis of a single email
As the **Curator** I want to open an email preview and correct the AI's analysis so that the relationship graph updates from my correction and future analysis learns from it.
- **AC1** From an email preview I can edit the extracted entity/type the AI assigned.
- **AC2** Saving a correction updates the affected entity relationships immediately.
- **AC3** A visible confirmation shows the correction propagated ("reprocessed N emails with your correction").
- **AC4** The correction is stored as a labeled example (positive/negative) for the resolver.
- **Satisfied by:** EN-04, AI-03, ST-04

---

## Surface 2 — Entity Resolution & Curation

### S2.1 — Abstract entity detection across addresses/domains
As the **Operator** I want the AI to recognize that emails from different addresses or domains belong to the same abstract entity so that one person or organization isn't scattered across a dozen raw senders.
- **AC1** Emails from distinct addresses that represent one entity are grouped under a single resolved entity.
- **AC2** Each resolved entity lists its aliases (the underlying sender addresses/domains).
- **AC3** Grouping runs automatically at ingest and improves as corrections accumulate.
- **AC4** Confidence/evidence for a grouping is inspectable, not opaque.
- **Satisfied by:** AI-03, EN-02

### S2.2 — Merge-review queue (human-gated)
As the **Curator** I want a review queue of AI-proposed entity merges so that auto-resolution stays trustworthy behind a human gate.
- **AC1** Proposed merges appear in a queue with side-by-side comparison of the two entities.
- **AC2** I can accept a merge (writes `merged_into`) or reject it (recorded as a negative example).
- **AC3** Accepting a merge collapses the two entities everywhere they render (canvas, table, treemap).
- **AC4** Nothing merges without my explicit action.
- **Satisfied by:** EN-02, AI-03

### S2.3 — Entity table as a working grid
As the **Curator** I want the entities list rendered as a spreadsheet-like grid so that I can sort, filter, and spot "needs review" entities with conditional formatting.
- **AC1** The entities table supports sorting and a column menu.
- **AC2** Conditional formatting highlights review-needed / low-confidence rows.
- **AC3** Edits to entity fields persist through the entities mutations router.
- **AC4** The grid stays responsive over a large entity set.
- **Satisfied by:** EN-01, CV-03 (grid substrate)

### S2.4 — Entity dossier
As the **Operator** I want each entity's detail page to act as a scoped board showing its threads, knowledge subgraph, documents, and a mini treemap of its mail so that one screen tells the whole story of a relationship.
- **AC1** `/entities/[id]` renders threads, a knowledge subgraph, and related documents together.
- **AC2** A scoped mini circle-pack of that entity's mail is embedded.
- **AC3** The dossier uses the same persistent-board mechanism as home (scoped to `entity:{id}`).
- **AC4** Objects on the dossier support send-to-chat / send-to-canvas.
- **Satisfied by:** EN-03, TM-03, HM-01 (scoping), AI-04

---

## Surface 3 — Canvas & Circular Treemap

### S3.1 — Entities and communications on canvas
As the **Operator** I want to see abstract entities, their senders, and related communications on the canvas so that I can navigate my correspondence spatially rather than as a flat list.
- **AC1** Entities render as canvas nodes with avatar/type/alias-count and open `/entities/[id]`.
- **AC2** Email threads render as nodes that deep-link to the email.
- **AC3** Relationships between entities and communications render as edges.
- **AC4** Entity nodes offer send-to-chat.
- **Satisfied by:** CV-01, AI-04, AI-03

### S3.2 — Email circle-pack view
As the **Operator** I want to view my email as a zoomable circular treemap (entity → thread → email) so that I can see my correspondence as a landscape and drill into what's biggest or most recent.
- **AC1** A circle-pack view groups by resolved entity, then thread, then email.
- **AC2** Leaf size reflects message count or bytes; tint reflects recency/unread.
- **AC3** Clicking a leaf deep-links to `/emails/[id]`; clicking an entity circle offers send-to-chat.
- **AC4** Zoom in/out is animated and keyboard-navigable (arrow = sibling, Enter = zoom, Esc = out).
- **Satisfied by:** TM-02, TM-01, AI-03, AI-04

### S3.3 — AI establishes the treemap groupings and labels
As the **Operator** I want the AI to establish the relationships, the bundling of circles, and the label on each bundle so that the treemap structure reflects meaning, not just raw address strings.
- **AC1** Circle groupings derive from resolved entities, not raw sender addresses.
- **AC2** Each bundling circle carries an AI-generated label describing what it contains.
- **AC3** Correcting an entity (S1.4/S2.2) changes the grouping and labels accordingly.
- **Satisfied by:** AI-03, TM-02, TM-01

### S3.4 — Agent places nodes on the canvas
As the **Builder** I want the AI to materialize nodes it talks about (sources, email threads, documents, treemaps) mid-turn so that the conversation and the canvas stay in sync without manual placement.
- **AC1** A research turn drops `source` nodes; "open that thread" drops an `email-thread` node.
- **AC2** A generated document appears as a `document` node.
- **AC3** "Show me what's eating my drive" places a treemap node scoped to the vault.
- **AC4** Unknown/invalid agent node output fails safe (no crash; validated by the node schema).
- **Satisfied by:** AI-01, TM-03, CV-01

### S3.5 — Right-click context menus
As the **Builder** I want right-click menus on the pane, nodes, edges, and selections so that canvas verbs are discoverable and I'm not hunting through toolbars.
- **AC1** Pane menu offers Add node (one entry per registered node type), Paste, Fit view, Save as template.
- **AC2** Node menu offers type-specific verbs plus Duplicate / Remove / Connect to… / Send to chat.
- **AC3** Edge menu offers Edit label / Reverse / Delete / Open payload.
- **AC4** Irreversible verbs (e.g. destroy a desktop) trigger a confirm modal driven by capability metadata.
- **Satisfied by:** CI-01, AI-04, CV-04

### S3.6 — Keyboard command map + palette
As the **Builder** I want a full keyboard command map and a command palette so that I can drive the canvas without the mouse and add nodes by name.
- **AC1** Delete/Backspace deletes the selection with an undo toast; Cmd/Ctrl+A/D/C/V/X/Z work.
- **AC2** Tab/Shift+Tab cycle node focus; Enter opens the focused node's primary action.
- **AC3** Cmd/Ctrl+K opens a palette that adds nodes and runs verbs (shared with the omnibox).
- **AC4** The keyboard hint card reflects the same command table.
- **Satisfied by:** CI-02, CI-05, CI-06, AI-05

### S3.7 — Drag interactions
As the **Builder** I want to drag email rows, files, entities, or OS files onto the canvas and drag nodes into the composer so that adding and attaching context is direct manipulation.
- **AC1** Dropping an inbox row / file row / entity card onto the canvas creates the matching node at the drop point.
- **AC2** Dropping an OS file uploads it and creates a file node.
- **AC3** Dragging a node onto the chat composer attaches it as context.
- **AC4** Dropping a drag-connection on empty pane opens a target-filtered edge picker.
- **Satisfied by:** CI-03, AI-04, DR-01

### S3.8 — Multi-select + bulk actions
As the **Builder** I want rubber-band and additive multi-select with a floating toolbar so that I can act on many nodes at once, including asking the agent to synthesize them.
- **AC1** Shift-drag rubber band and Cmd/Ctrl-click additive select work for all node types.
- **AC2** A floating toolbar offers align/distribute, group-move, bulk delete, bulk connect.
- **AC3** "Summarize these N nodes in chat" runs one synthesis turn over the selection.
- **AC4** Source-canon accumulation remains available as a mode of the general mechanism.
- **Satisfied by:** CI-05, CI-01, AI-01

### S3.9 — Undo/redo
As the **Builder** I want undo/redo for canvas mutations so that experimenting with layout and structure is safe.
- **AC1** Add/remove/move/connect/label operations are undoable and redoable.
- **AC2** Undo is available via keyboard and reflected in a toast.
- **AC3** Chat content is out of scope for canvas undo (no accidental message loss).
- **Satisfied by:** CI-06, CI-02, CI-04

### S3.10 — Unified add/remove node flow
As the **Builder** I want one "Add node" entry point and one removal path so that the canvas behaves consistently regardless of node type.
- **AC1** A single Add-node entry (context menu + palette + empty-state CTA) enumerates all node types.
- **AC2** All removal paths (×, Delete key, context menu) route through one remove operation.
- **AC3** Removal schedules persistence, pushes an undo entry, and announces via aria-live.
- **Satisfied by:** CI-04, CI-01, CI-06

### S3.11 — Canvas templates / packs
As the **Builder** I want to save and load named canvas layouts so that I can spin up a "research board" or "email triage board" instantly, including as the agent's first act.
- **AC1** I can save the current layout as a named template (minus instance ids).
- **AC2** Loading a template instantiates its nodes on a fresh canvas.
- **AC3** The agent can instantiate a template ("set up a research board for this").
- **Satisfied by:** CV-04, AI-01

---

## Surface 4 — Drive, OneDrive Migration & Files-in-Chat

### S4.1 — 500GB OneDrive migration as one folder
As the **Operator** I want to upload a single top-level folder containing ~500GB of mixed files migrated from OneDrive so that my whole archive lands in Polytoken without per-file babysitting.
- **AC1** A large nested folder uploads with visible progress and resumability.
- **AC2** Upload respects a quota/usage meter and soft-blocks only when over quota.
- **AC3** Mixed file types (images, documents of many formats, large multi-GB files) all ingest.
- **AC4** Folder structure is preserved on arrival.
- **Satisfied by:** DR-04, DR-01, DR-05

### S4.2 — Drive table-stakes verbs
As the **Operator** I want rename, move, and multi-select bulk operations in the vault so that managing a migrated archive is practical.
- **AC1** I can rename and move files/folders via a row context menu.
- **AC2** Shift-click range select enables bulk move/delete.
- **AC3** Operations persist and reflect immediately in the listing.
- **Satisfied by:** DR-01

### S4.3 — Backups, versioning, and no catastrophic loss
As the **Operator** I want file versioning and a trash with retention so that no edit or deletion causes irrecoverable data loss.
- **AC1** Editing a file keeps prior versions; "restore version" is available in the row menu.
- **AC2** Delete is a soft-delete to trash with a retention window, restorable before purge.
- **AC3** Version blobs are stored via the existing storage adapter (key-suffix scheme).
- **AC4** Daemon-watched folders can back up one-way into the vault on a schedule.
- **Satisfied by:** DR-02, DR-06

### S4.4 — Files in chat
As the **Operator** I want to attach my Polydrive files (or upload new ones) to a chat conversation so that the agent can reason over my documents.
- **AC1** The composer has an attach affordance: attach-from-vault and attach-by-upload.
- **AC2** Attached files become chat context and optionally a canvas file node.
- **AC3** The agent can actually read attached file content (extracted text), not just the filename.
- **AC4** "Ask about this file" from a vault row opens a conversation with the file attached and a file node on canvas.
- **Satisfied by:** CH-01, DR-03, DR-05, CV-01, AI-04

### S4.5 — Drive as circular treemap with agent-generated leaf views
As the **Operator** I want to visualize my drive as a circular treemap where the agent renders custom visualizations for subfolders (e.g. an image grid for a photo folder, a doc view for thousands of documents) so that huge, varied archives are legible on the canvas.
- **AC1** A drive circle-pack groups folders → files with leaf size = bytes.
- **AC2** Zooming into a folder circle mirrors `/files` navigation (shared store).
- **AC3** The agent chooses a fitting frontend representation per subfolder based on its contents (image-heavy, document-heavy, mixed/large).
- **AC4** Folder-size aggregates power both the treemap and the quota meter.
- **Satisfied by:** TM-04, TM-01, DR-04, AI-01

### S4.6 — Deep drive context in chat
As the **Operator** I want the chat agent to search, manage, and create files and directories in my drive so that the assistant is a real file-system collaborator.
- **AC1** The agent can search vault contents by text (extracted + embedded).
- **AC2** The agent can create folders/files and organize the vault on request.
- **AC3** File content participates in cross-surface semantic search.
- **Satisfied by:** DR-05, AI-05, CH-01

---

## Surface 5 — Agentic GenUI Home Board

### S5.1 — Persistent, AI-generated home surface
As the **Builder** I want a persistent home board that is entirely and exclusively agentically genui-generated so that my landing page is a living dashboard the agent curates, not a static inbox.
- **AC1** `/` renders a pinned, conversation-independent canvas (a `home`-scoped layout).
- **AC2** Panels persist position/size across sessions.
- **AC3** The default board includes an inbox summary, today's entities, recent documents, vault usage, and cost meter.
- **AC4** The inbox three-pane remains one click away.
- **Satisfied by:** HM-01, CV-02, AI-01

### S5.2 — Agentically generate persistent panels
As the **Builder** I want to ask the agent to generate persistent panels with specific information in a chosen design/component pattern so that I compose my dashboard in natural language.
- **AC1** I can request a panel ("pin a panel of unpaid-invoice entities as a table") and it appears.
- **AC2** Panels can be data-bound to live queries and stay current.
- **AC3** Panel styling follows the design system / component pattern I specify.
- **Satisfied by:** HM-01, CV-02, CV-03, AI-01

### S5.3 — Panel manipulation (drag/drop/resize/snap/stash)
As the **Builder** I want to drag, drop, expand, resize, snap, remove, and hide/stash/bench panels with persistence so that arranging my board feels tactile and my layout survives reloads.
- **AC1** Panels drag, resize, and snap; layout diffs persist automatically.
- **AC2** Panels can be removed and hidden/stashed/benched and later restored.
- **AC3** I can pin/lock a panel so the agent won't rearrange it.
- **Satisfied by:** HM-01, CV-02, CI-06

### S5.4 — Processing reports as emails arrive
As the **Operator** I want the home board to show reports of email processing and AI analysis as mail comes in so that the board is my live operations view of the pipeline.
- **AC1** Incoming-email processing and analysis render as panels/updates on the board.
- **AC2** A morning-brief panel summarizes new mail by entity, pending merges, and overnight documents.
- **AC3** Scheduled agent routines rearrange/repopulate panels.
- **Satisfied by:** HM-01, HM-02, CH-03, ST-04

### S5.5 — Scheduled agent routines
As the **Operator** I want scheduled/recurring agent runs (e.g. a daily triage) so that routine synthesis happens without me starting it.
- **AC1** A daily routine summarizes new email, proposes entity merges, and updates the home board.
- **AC2** Routine output arrives as ordinary chat turns + canvas mutations.
- **AC3** Routines are configurable (schedule, prompt) from settings.
- **Satisfied by:** CH-03, AI-01, AI-03, HM-02

---

## Surface 6 — Remote Desktops

### S6.1 — Run one or multiple persistent remote desktops
As the **Operator** I want persistent, robust remote desktops I can select and run one or many at a time so that I have cloud workstations available on demand from any device.
- **AC1** I can launch a desktop and see it as a live node on the canvas (jailed stream iframe).
- **AC2** Multiple desktops can run concurrently.
- **AC3** Desktops are persistent across sessions until hibernated/destroyed.
- **AC4** Destroying a desktop requires a confirm modal (irreversibility metadata).
- **Satisfied by:** DX-03, ST-03, AI-02

### S6.2 — Live cost and per-hour reporting
As the **Operator** I want a live cost ticker and per-hour rate on each running desktop so that I always know what I'm spending.
- **AC1** Each desktop node chrome shows its hourly rate and accruing cost.
- **AC2** A desktop-management pane lists all sessions with live cost.
- **AC3** Idle desktops are reaped/hibernated per policy to avoid runaway cost.
- **Satisfied by:** DX-03, ST-03

### S6.3 — Desktop as an agent tool
As the **Builder** I want the agent to spawn/attach a desktop within permission gates so that it can, e.g., open a file on a desktop and screenshot it back into the canvas.
- **AC1** The agent can request a desktop session subject to the permission model.
- **AC2** The agent can open a file on the desktop and capture a screenshot into a canvas node.
- **AC3** All agent desktop actions honor the confirm gates on irreversible verbs.
- **Satisfied by:** DX-04, DX-03, AI-01

---

## Surface 7 — Distributed Inference & Credit Sharing

### S7.1 — Run inference on my own hardware
As the **Consumer** I want to pick a model that runs on my own machine via the daemon so that local compute is a first-class model-picker choice at $0 cost.
- **AC1** The model picker offers a `daemon-local` execution locus.
- **AC2** Running a summarization on my desktop GPU works and reports $0 cost.
- **AC3** The choice is a normal picker option, not a special mode.
- **Satisfied by:** DX-01, AI-02, CH-02

### S7.2 — Optimal model recommendation per device
As the **Consumer** I want to open the website, desktop app, and phone web app on different devices and be recommended (or choose) a model optimal for each device's hardware so that each surface runs what it can handle well.
- **AC1** Each device surface can recommend a model based on its hardware/setup.
- **AC2** I can run different models on website, desktop, and phone concurrently.
- **AC3** WebLLM local inference is available where the browser supports it, managed from settings.
- **Satisfied by:** DX-01, CH-02, ST-01

### S7.3 — Contribute an LLM and earn credits
As the **Host** I want to provide an LLM / idle compute and earn credits so that my spare hardware pays for heavier models I use later.
- **AC1** I can register my machine/model as a pooled inference provider.
- **AC2** Serving inference to the pool accrues credits to my account.
- **AC3** I can choose whether idle compute is used, and opt out at any time.
- **AC4** BYOK provider keys are stored encrypted and never exposed to the browser.
- **Satisfied by:** DX-02, ST-02, DX-01
- **Note:** venture-gated in the catalog; runsheet should treat as design/spike, not shippable slice.

### S7.4 — Join a pool and share gains
As the **Consumer** I want to spend credits to use heavier models served by other users' hardware so that I can run compute I couldn't host myself, with shared accounting.
- **AC1** A pooled execution locus is selectable in the model picker.
- **AC2** Credits are debited for pooled inference and the accounting is transparent.
- **AC3** Pool participation requires multi-user groundwork and BYOK/credit accounting to be in place.
- **Satisfied by:** DX-02, ST-02
- **Note:** gated behind the venture decision and multi-user; do not schedule before the gate.

---

## Surface 8 — Multiuser / Teams / Workspaces

### S8.1 — Personal vs business/organization separation
As the **Admin** I want personal, business, organization, team, and workspace scopes with distinct permissions so that I can separate solo work from shared org work.
- **AC1** Objects (conversations, canvases, entities, files) carry an ownership/scope discriminator.
- **AC2** A workspace/org scope is distinct from personal scope.
- **AC3** No existing single-user feature silently requires sharing to function (backward compatible).
- **Satisfied by:** ST-01 (capabilities/permissions home), plus multi-user groundwork (greenfield; catalog Assumption 1)

### S8.2 — Access, sharing, and permissions
As the **Admin** I want to grant members scoped access and share specific surfaces so that teammates see only what they should.
- **AC1** I can share a conversation/canvas/entity/file with a member at a chosen access level.
- **AC2** Per-capability allow/ask/deny is configurable, driven by risk/reversibility metadata.
- **AC3** Cross-conversation canvas references render as read-only ghost nodes with "open origin."
- **Satisfied by:** ST-01, CV-05, AI-02
- **Note:** multi-user is greenfield in the catalog; these stories define the target, and the runsheet should mark them as foundation-dependent.

### S8.3 — Member scoped experience
As the **Member** I want to work in a shared workspace with access only to what I've been granted so that I can collaborate without seeing the whole org.
- **AC1** A member sees only shared/granted objects.
- **AC2** A member's capability set is bounded by the permission model.
- **AC3** Shared boards stay consistent as the owner updates them.
- **Satisfied by:** ST-01, CV-05, AI-02

---

## Cross-cutting integration stories (the connective thread)

### X.1 — Send-to-chat / send-to-canvas everywhere
As the **Operator** I want one shared "send to chat / send to canvas" action on every object (email, entity, knowledge node, file, document, capability card) so that context flows into conversations and boards uniformly.
- **AC1** Every object surface exposes the same send-to-chat / send-to-canvas affordance.
- **AC2** Sending to chat attaches the object as context; sending to canvas drops the matching node.
- **Satisfied by:** AI-04, AI-01, CV-01, DR-03

### X.2 — Cross-surface omnibox (Cmd/Ctrl+K)
As the **Operator** I want one omnibox that searches emails, entities, knowledge, files, documents, and conversations so that I can find anything and act on it from one place.
- **AC1** A single search returns typed results across all surfaces.
- **AC2** Each result deep-links and offers send-to-chat/canvas.
- **AC3** The same component doubles as the canvas command palette.
- **Satisfied by:** AI-05, AI-04, CI-02

### X.3 — Every capability has a face
As the **Builder** I want each capability to render as an LLM tool, a `/capabilities` card, a genui block, and a canvas node so that the AI reads the same declarations the UI renders.
- **AC1** Each capability in the manifest projects to all four surfaces.
- **AC2** A CI check fails the build if any capability lacks one of the four projections.
- **Satisfied by:** AI-02

### X.4 — Agent memory over the knowledge graph
As the **Operator** I want each chat turn to pull relevant canon knowledge and entity profiles into context with citations so that the agent reasons with my accumulated knowledge, writing back only suggestions.
- **AC1** Relevant tier-canon edges + entity profiles are retrieved into the system context per turn.
- **AC2** Citations render via the research-trace component linking back to `/knowledge` nodes.
- **AC3** New edges are proposed at "suggested" tier, never auto-promoted.
- **Satisfied by:** AI-06, AI-03, KN-01, KN-02

### X.5 — Frontend fluidity
As the **Operator** I want page changes and component interactions to feel snappy, frictionless, and persistent so that the whole app feels fluid rather than clunky.
- **AC1** Navigating between pages preserves relevant state (no jarring resets).
- **AC2** Panels and canvas interactions respond without perceptible lag.
- **AC3** Interaction-heavy surfaces (canvas, treemap, grid) stay responsive at scale.
- **Satisfied by:** cross-cutting (informs CV-02, CI-*, TM-01, HM-01); no single ID — track as a quality bar across waves.

---

## ID coverage checklist

- **AI-\*:** AI-01 (S3.4, S3.8, X.1), AI-02 (S6.1, X.3), AI-03 (S1.1–S1.4, S2.1–S2.2, S3.2–S3.3), AI-04 (S3.1, S3.5, X.1–X.2), AI-05 (S3.6, S4.6, X.2), AI-06 (X.4)
- **CV-\*:** CV-01 (S3.1, S3.4, S4.4), CV-02 (S5.1–S5.3), CV-03 (S2.3, S5.2), CV-04 (S3.5, S3.11), CV-05 (S8.2–S8.3)
- **CI-\*:** CI-01 (S3.5, S3.8, S3.10), CI-02 (S3.6, S3.9, X.2), CI-03 (S3.7), CI-04 (S3.9–S3.10), CI-05 (S3.6, S3.8), CI-06 (S3.6, S3.9–S3.10, S5.3), CI-07 (via CI-02)
- **TM-\*:** TM-01 (S3.2–S3.3, S4.5), TM-02 (S3.2–S3.3), TM-03 (S2.4, S3.4), TM-04 (S4.5)
- **CH-\*:** CH-01 (S4.4, S4.6), CH-02 (S7.1–S7.2), CH-03 (S5.4–S5.5)
- **DR-\*:** DR-01 (S3.7, S4.1–S4.2), DR-02 (S4.3), DR-03 (S3.1 via X.1, S4.4), DR-04 (S4.1, S4.5), DR-05 (S4.1, S4.4, S4.6), DR-06 (S4.3)
- **HM-\*:** HM-01 (S2.4, S5.1–S5.4), HM-02 (S5.4–S5.5), HM-03 (via TM-03/HM-01)
- **EN-\*:** EN-01 (S2.3), EN-02 (S1.1, S2.1–S2.2), EN-03 (S2.4), EN-04 (S1.3–S1.4)
- **ST-\*:** ST-01 (S5.1 cost meter, S7.2, S8.1–S8.3), ST-02 (S7.3–S7.4), ST-03 (S6.1–S6.2), ST-04 (S1.1–S1.4, S5.4)
- **KN-\*:** KN-01, KN-02 (X.4)
- **DX-\*:** DX-01 (S7.1–S7.2, S7.3), DX-02 (S7.3–S7.4), DX-03 (S6.1–S6.3), DX-04 (S6.3)
