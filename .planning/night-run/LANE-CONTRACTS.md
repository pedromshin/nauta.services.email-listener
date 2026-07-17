# Lane Contracts — parallel worktree execution, night of 2026-07-16

**User directive (verbatim intent): "we need to do as much as possible from the whole thing
tonight, up to 2.2."** Strategy: working VERTICAL SLICES of every ladder rung in parallel lanes —
real, usable, end-to-end cores; no stubs (user's standing depth-first rule); remaining breadth
enumerated in backlog, never faked.

Every lane agent reads THIS FILE FIRST. Violating a boundary is the failure mode that cost this
milestone real work (index races, swept commits, reverted progress).

## The five lanes

| Lane | Worktree / branch | Slice (the switch-moment core) | Phase dir |
|---|---|---|---|
| A | main checkout (orchestrator) | v1.10 completion: Phases 62, 63 + verify + integrate all lanes | 62-*, 63-* |
| B | `../polytoken-lanes/lane-b` · `lane/64-research-docs-mail` | v1.11: in-chat deep research (multi-step, cited) + PDF/document export + email rules engine fixture-first | 64-research-docs-mail |
| C | `../polytoken-lanes/lane-c` · `lane/65-daemon` | v2.0: the daemon — ONE permission model, ToolExecutor (fs/terminal/git), one watched folder live, WS server + protocol package | 65-agent-daemon |
| D | `../polytoken-lanes/lane-d` · `lane/66-files-vault` | v2.1: /files self-cloud vault over Supabase Storage (upload/browse/download/delete, folder tree) | 66-files-vault |
| E | `../polytoken-lanes/lane-e` · `lane/67-sessions` | v2.2: live Claude Code session streaming — daemon PTY → WS → /sessions web terminal (xterm-class), input + output | 67-session-streaming |

Lane B waits for the strategy sweep's v1.11 draft (minutes away). C and D start immediately.
E plans immediately against the protocol contract below; executes after C's first merge.

## Owned paths (a lane may create/edit ONLY within its rows)

- **A:** `apps/web/src/app/knowledge/**`, `studio/**`, `settings/**`, `login/**`, `globals.css`,
  `role-hue-ban` ratchet, all `.planning/**` on main, nav/sidebar, tRPC root router, migrations
- **B:** `apps/web/src/app/chat/_research/**` (new), `packages/research/**` (new),
  `apps/web/src/server/api/routers/research*` (new files only), `apps/web/src/app/emails/_rules/**`
  (new), `.planning/phases/64-*/**`
- **C:** `apps/daemon/**` (new), `packages/daemon-protocol/**` (new), `.planning/phases/65-*/**`
- **D:** `apps/web/src/app/files/**` (new), `apps/web/src/server/api/routers/files*` (new),
  `packages/storage/**` (new, optional), `.planning/phases/66-*/**`
- **E:** `apps/web/src/app/sessions/**` (new), daemon session module ONLY under
  `apps/daemon/src/sessions/**` (C must not create that dir), `.planning/phases/67-*/**`

**Reserved to the orchestrator (Lane A), requested via your SUMMARY, never edited by lanes:**
sidebar/nav registration, tRPC `root.ts` router wiring, `package.json`/lockfile changes (declare
deps in your SUMMARY's `deps:` list — A installs at merge), `drizzle` migrations (see queue),
`globals.css`, README/CLAUDE.md.

## Taste layer (user directive, added mid-run — binding on every UI-building lane)

The user's parting instruction, verbatim: *"make good ui pls"* and *"minimize clicks … you
typically make good generic uis … lets make it a little better by researching patterns and
references. this is mostly a matter of taste."*

1. **Before building any surface**, executors read `docs/design/taste-references.md` (being
   produced by the ui-taste-sweep workflow from the user's own curated links.md + design case +
   per-surface pattern research) AND invoke the `frontend-design` skill. If the taste doc has not
   landed yet when an executor starts, the orchestrator injects its content at dispatch.
2. **Click economy is a requirement, not a vibe:** the surface's primary action is reachable in
   ≤1 click or 1 keystroke from arrival; inline edit beats a modal; hover/focus-reveal for
   secondary actions; undo beats confirm EXCEPT the genuinely irreversible (madder rule); empty
   states teach the next action instead of announcing emptiness.
3. **References feed layout/density/hierarchy/interaction ONLY.** Palette and typography are
   LOCKED (D-58-01). A borrowed pattern that fights the identity gets adapted or dropped, and the
   summary says which.
4. **Anti-generic bar:** no centered-card-with-shadow syndrome, no icon-button rows without
   accessible labels, no modal-for-everything, no default-shadcn look wearing our tokens. The
   taste doc's anti-generic checklist is part of post-merge screenshot review.

## Protocols

1. **Commits:** scoped `git add <owned paths>` only. Never `-A`. Never `git checkout --` without a
   backup copy. Commit to YOUR branch only. Do not push (orchestrator pushes after merge).
2. **Migrations queue:** lanes NEVER run drizzle-kit generate. Write the schema you need in your
   package/phase dir as `SCHEMA-REQUEST.md` (tables, columns, indexes) + Drizzle schema files in
   your owned paths guarded so they compile without the migration. Orchestrator generates
   migrations sequentially at merge (journal collisions destroyed work in v1.6).
3. **Quality bar per lane:** `npx tsc --noEmit` clean in your worktree + your new tests green +
   the touched package's existing tests green. Full-suite, geometry gate, and screenshot review run
   POST-MERGE on main by the orchestrator. NEVER run `npx playwright test` bare, and never start a
   dev server in a worktree (port 3000 is main's; if you must render, note it in SUMMARY for
   post-merge visual review).
4. **DB:** the shared local Supabase is main's. Lanes' unit tests must not depend on new tables
   (mock/fixture until merged migration).
5. **Boundary validation:** all new inputs cross zod schemas (user's standing rule). Secrets via
   env only; the daemon's WS token is env-read, never hardcoded.
6. **Tenancy accommodation (from tonight's tenancy audit):** every new table carries the standard
   ownership columns the codebase already uses (`user_id`, and `importer_id` where content-scoped);
   every new tRPC procedure goes through the existing auth context. No new global singletons.
7. **Model policy:** executors run fable, xhigh. Mechanical doc tasks sonnet.
8. **When done or blocked:** write your phase SUMMARY with: what is USABLE end-to-end, deps needed,
   nav/router wiring requests, schema requests, what was deliberately deferred. Return a short
   report. The orchestrator merges — you never merge yourself.

## The daemon protocol contract (C builds it, E consumes it — frozen tonight)

`packages/daemon-protocol` exports zod schemas + TS types:

```ts
// transport: WebSocket ws://127.0.0.1:8787, header "x-daemon-token: <env DAEMON_TOKEN>"
type Envelope = { id: string; type: MsgType; payload: unknown };
type MsgType =
  | "session.list"      // -> { sessions: SessionMeta[] }
  | "session.start"     // { cwd, cmd? }            -> SessionMeta
  | "session.attach"    // { sessionId }            -> stream of session.output
  | "session.output"    // { sessionId, seq, data } // server->client, ordered
  | "session.input"     // { sessionId, data }
  | "session.resize"    // { sessionId, cols, rows }
  | "session.exit"      // { sessionId, code }
  | "fs.watch.event"    // { root, path, kind }
  | "tool.request"      // { tool, args }           // fs/terminal/git via ToolExecutor
  | "tool.result"       // { requestId, ok, output }
  | "perm.request"      // { tool, args, risk }     // ONE permission model
  | "perm.decision";    // { requestId, allow, remember }
type SessionMeta = { sessionId: string; cwd: string; cmd: string; startedAt: string; alive: boolean };
```

Rules: every payload zod-validated both sides; `session.output` is ordered by `seq` (client
reassembles); permission decisions persist to the daemon's allowlist file (the ONE permission
model — same store the ToolExecutor consults). Localhost-only tonight; remote tunnel is backlog
(the "from anywhere" tier rides on it later — do not attempt tunneling tonight).

## Slice definitions (what "done tonight" means — no more, no less)

- **B:** In an existing chat, a research request runs a REAL multi-step loop (plan → web_search
  rounds → fetch/read → synthesize) streaming progress as tool rounds, ending in a cited report
  message whose sources land in the RCNV-01 source ledger; report exports to PDF (local-first:
  playwright-core print route is acceptable; Vercel-side rendering is backlog); email RULES:
  rules table request + matcher engine (sender/subject/regex → suggest label/spam/extract) run
  against the fixture corpus with a suggest-only review surface in the inbox. LEARN loop tie-in
  noted, not rebuilt.
- **C:** `apps/daemon` starts on the PC, loads allowlist, executes fs/terminal/git tool requests
  under the permission model, watches ONE configured folder emitting fs.watch.event, serves the WS
  protocol with token auth. A tiny CLI smoke script proves each capability. Registry table:
  SCHEMA-REQUEST only.
- **D:** /files renders a real vault over Supabase Storage bucket `user-files`: folder tree,
  upload (drag or picker), download, delete with confirm (madder—irreversible, law 1), empty/
  loading/error states production-grade (SURF-06 bar), identity-compliant (serif for user file
  names? NO — file names are METADATA/chrome, sans; file CONTENT previews are evidence).
  Tenancy: storage paths namespaced `{userId}/...`.
- **E:** /sessions lists daemon sessions, attaches to one, renders live terminal output with
  input, in the locked identity (terminal chrome ink, no madder on exit codes — a nonzero exit is
  a STATUS). Reconnect resumes from last seq. Desktop-first; mobile = readable stream (input
  optional tonight).

## Integration order (orchestrator)

C skeleton → merge → E executes. B, D merge independently when green. A merges 62 → 63 → lanes as
they land, running: full vitest + tsc + test:geometry + screenshot:review (+ read the PNGs, both
themes) before every push. Nav/router/deps/migrations happen in A's integration commits.
