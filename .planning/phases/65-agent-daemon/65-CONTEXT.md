# Phase 65: Agent Daemon (v2.0 vertical slice) — Context

**Gathered:** 2026-07-17 (night run, Lane C)
**Status:** Ready for planning
**Mode:** Lane-dispatched — LANE-CONTRACTS.md is the law. This phase runs in the worktree
`C:\Users\pc\Desktop\polytoken-lanes\lane-c` on branch `lane/65-daemon`. The main checkout has its
own writer; nothing here ever touches it.

<domain>
## Phase Boundary

Build the v2.0 daemon SLICE (LANE-CONTRACTS.md §Slice definitions, row C — no more, no less):
`apps/daemon` starts on this Windows PC, loads a persistent allowlist implementing the ONE
permission model, executes `tool.request` for fs/terminal/git — every one consulting the permission
store — watches ONE configured folder emitting `fs.watch.event`, and serves the frozen WS protocol
with `x-daemon-token` auth, bound to 127.0.0.1 ONLY. Plus `packages/daemon-protocol`: zod schemas +
TS types for EVERY envelope/payload (including `session.*` — Lane E consumes them). A CLI smoke
script proves each capability end-to-end. Registry table = `SCHEMA-REQUEST.md` only.

**Requirements (defined here — v2.0 has no REQUIREMENTS.md rows yet; these IDs are this slice's
traceability anchors, to be folded into REQUIREMENTS.md by the orchestrator at merge):**

- **DMON-01** — daemon boots on Windows via `tsx`: refuses to start without `DAEMON_TOKEN` (≥16
  chars), zod-validates `daemon.config.json` at startup, logs where it listens without ever
  logging the token.
- **DMON-02** — the ONE permission model: hard default-deny outside configured roots (never
  promptable), persistent allowlist file consulted by EVERY tool execution, ask-then-remember via
  `perm.request`/`perm.decision`, unanswered ask times out to DENY, explicit deny beats allow,
  corrupt store fails CLOSED (no remembered allows).
- **DMON-03** — ToolExecutor for fs (read/write/list within roots), terminal (spawn with
  `shell: false`, args arrays only, mandatory timeout, bounded output capture, token scrubbed from
  child env), git (status/log/diff/branch/add/commit via safe spawn, `--` before pathspecs) — all
  routed through the permission broker, no bypass path.
- **DMON-04** — chokidar watches the ONE configured folder and broadcasts `fs.watch.event` to every
  authed client.
- **DMON-05** — `packages/daemon-protocol` implements the LANE-CONTRACTS.md protocol EXACTLY as
  frozen (all 12 MsgTypes, SessionMeta shape verbatim); WS server on `ws://127.0.0.1:<port>`
  rejects missing/wrong `x-daemon-token` at upgrade time; every payload zod-validated in BOTH
  directions.
- **DMON-06** — `scripts/smoke.ts` proves every capability end-to-end over a real WS connection,
  including the negative proofs (wrong token 401, outside-roots deny with NO perm prompt, injection
  string inert, timeout kill, allowlist survives daemon restart).

**OUT (Lane E's, phase 67):** `apps/daemon/src/sessions/**` — do not create that directory. C ships
the router SEAM (default `session.list → { sessions: [] }`, other `session.*` → structured
`not_implemented`) that E replaces. PTY, xterm, /sessions UI: all E.

**OUT (backlog, explicitly banned tonight):** remote tunnel / "from anywhere" tier
(LANE-CONTRACTS.md: "do not attempt tunneling tonight"), browser panel CDP, directory-panel UI,
registry table as live runtime storage (file store is the runtime source; the table is a
SCHEMA-REQUEST), binary-file fs tool payloads, multi-folder watch, WSS/TLS.
</domain>

<decisions>
## Implementation Decisions

**The protocol is FROZEN** (LANE-CONTRACTS.md §"The daemon protocol contract"). The 12 MsgTypes,
the `Envelope = { id, type, payload }` shape, `SessionMeta = { sessionId, cwd, startedAt, cmd,
alive }`, transport `ws://127.0.0.1:8787` + header `x-daemon-token: <env DAEMON_TOKEN>` — verbatim,
drift breaks Lane E. Where the contract is silent, the following resolutions were made tonight
(documented, not blocked on):

- **R-01 (response correlation):** a response envelope echoes the request's `id` and `type`
  (`session.list` request → envelope `{ id: <same>, type: "session.list", payload: { sessions } }`).
  `tool.request` is the exception the contract itself makes: it is answered by a `tool.result`
  envelope (fresh id) whose payload `requestId` = the request envelope's `id`.
- **R-02 (protocol errors):** a frame that fails JSON.parse or zod is dropped + logged; if an `id`
  is recoverable the daemon replies `tool.result { requestId: <id>, ok: false, output: { kind:
  "error", code: "protocol_error", message } }`. The socket stays open (a typo in a dev client must
  not kill Lane E's session stream). No new MsgType is invented for errors.
- **R-03 (perm correlation):** `perm.request`'s payload is frozen as `{ tool, args, risk }` with no
  id field — so `perm.decision.requestId` correlates to the perm.request ENVELOPE's `id`. The
  daemon maps that back to the pending tool request internally. First decision wins; duplicates
  ignored.
- **R-04 (risk):** closed enum `"read" | "write" | "exec"`. fs.read/fs.list/git-read = read;
  fs.write/git add/commit = write; terminal.exec = exec.
- **R-05 (tool/args shapes):** `tool.request` payload is a discriminated union on `tool`:
  `fs.read`/`fs.write`/`fs.list`/`terminal.exec`/`git` — each with a `.strict()` `args` object
  (shapes in 65-01's interfaces). `tool.result.output`'s internal shape was left `unknown` by the
  contract; C defines it as a `kind`-discriminated union incl. `{ kind: "error", code, message }`.
- **R-06 (session.* tonight):** `session.list` answers honestly with `{ sessions: [] }`; every
  other `session.*` request gets `tool.result` `ok:false, code:"not_implemented"` — until Lane E
  registers real handlers through the router's registration seam. This is the contract's designed
  seam, not a stub of C's slice.
- **R-07 (binding):** host is the literal `"127.0.0.1"` in code — NOT configurable. Port is
  configurable (default 8787, `0` allowed so tests/smoke get an ephemeral port).
- **R-08 (protocol paths):** `fs.watch.event.root` is the absolute configured root; `path` is
  root-relative with FORWARD slashes (daemon normalizes Windows backslashes at the boundary).
- **R-09 (workspace reality):** root `package.json` `workspaces` is `["packages/*", "apps/web"]` —
  `apps/daemon` is NOT a workspace tonight. All its deps (`ws`, `chokidar`, `zod`) are already
  hoisted at root `node_modules` (verified in the worktree lockfile), so imports resolve by parent
  lookup; `@polytoken/daemon-protocol` resolves via tsconfig `paths` (tsx honors it). The
  orchestrator adds `"apps/daemon"` to `workspaces` at merge (wiring request in SUMMARY).
- **R-10 (`ws` types):** `ws@8.21.1` ships no types and `@types/ws` is not installed. `apps/daemon`
  carries a minimal local ambient shim `src/types/ws-shim.d.ts` typed to exactly the API used;
  `@types/ws` goes in the `deps:` request and the SUMMARY instructs the orchestrator to DELETE the
  shim in the same integration commit (both present = duplicate declarations).
- **R-11 (session.attach resume, additive):** `session.attach` args gain OPTIONAL `sinceSeq`, and
  its response is `{ sessionId, lastSeq }` — Lane E's slice says "reconnect resumes from last seq"
  and the frozen contract gave attach no response shape. Optional/additive only; the frozen fields
  are untouched.
- **R-12 (exit codes):** `session.exit.code` is `number` (frozen); the daemon coerces a
  signal-killed `null` to `-1` rather than making the schema nullable.
- **R-13 (executables vs roots):** roots bound DATA access and working directories (fs targets,
  exec/git `cwd`). The terminal executable itself naturally lives outside roots
  (`C:\Program Files\nodejs\node.exe`); it is permitted by NAME rule (case-folded basename,
  `.exe` stripped), not by path boundary. A shell binary (`cmd`, `powershell`) as the command
  re-opens injection INSIDE that grant — that is the user's explicit, remembered decision to make,
  surfaced with `risk: "exec"`.

**The permission model is the product.** Plan order: 65-01 protocol (the wire vocabulary + what E
merges against), 65-02 the permission core — the FIRST plan that touches `apps/daemon` is the
permission model, and both executor plans are gated behind it. Default-deny is in the engine, not
in call-site discipline.

Claude's discretion: internal module layout inside owned paths, exact zod refinement style, audit
log line shapes.
</decisions>

<code_context>
## Existing Code Insights

**Workspace conventions to mirror** (`packages/genui`, `packages/api-client`):
- `package.json`: `"name": "@polytoken/<pkg>"`, `private: true`, `"type": "module"`, source-first
  exports (`".": "./src/index.ts"`), scripts `typecheck: "tsc --noEmit"`, `test: "vitest run"`.
- `tsconfig.json`: `target es2022`, `module esnext`, `moduleResolution bundler`, `strict`,
  `noEmit`, `skipLibCheck`, `esModuleInterop`. daemon-protocol and apps/daemon use `lib:
  ["es2022"]` and `types: ["node"]` (NO dom — these are Node processes).
- zod pinned `^3.25.0` across the workspace (hoisted 3.25.76).

**Verified in this worktree's `node_modules` (nothing to install tonight):** `ws 8.21.1`,
`chokidar 3.6.0` (ships `./types/index.d.ts`), `zod 3.25.76`, `tsx 4.23.1`, `typescript 5.9.3`,
`vitest 2.1.9`, `@types/node 20.19.43`. Root `.bin` has `tsc`/`tsx`/`vitest` — `npx` resolves them
from any subdirectory. `@types/ws` is ABSENT (see R-10).

**Environment facts — bake into every verification block:**
- npm workspaces, NOT pnpm. `node_modules` may still be settling — planning needed none; execution
  uses only hoisted deps.
- NEVER a bare `npx playwright test`; NEVER start a dev server in this worktree (port 3000 is
  main's). This phase needs neither — everything verifies via `tsc`, `vitest`, and `tsx` scripts.
- Windows is the TARGET OS: paths are `C:\...`, the filesystem is case-insensitive, junctions
  exist without admin rights, `spawn` semantics differ (`windowsHide`, `taskkill /T` for
  tree-kill), signals are emulated.
- Scoped `git add .planning/phases/65-*` / `apps/daemon` / `packages/daemon-protocol` ONLY. Never
  `-A` (the worktree has an incidental `package-lock.json` modification — never commit it). Commit
  to `lane/65-daemon`; never push.
- Migrations queue: NEVER run drizzle-kit. The registry table is `SCHEMA-REQUEST.md` prose only.
</code_context>

<specifics>
## Specific Ideas

**Negative proofs for every gate** (Phase 61's discipline): the permission suite must prove escapes
are DENIED (`..\`, prefix-collision `C:\roots\abc` vs root `C:\roots\a`, junction escape, NUL byte,
ADS `file.txt:stream`, UNC), not just that happy paths are allowed. The smoke script must prove the
wrong token is REJECTED, the injection string is INERT (appears as a literal argv entry, no side
effect), the runaway process is KILLED, and the allowlist SURVIVES a daemon restart with no re-ask.

**Grep gates filter comments** (`grep -v` a comment pattern before `grep -c`), never bare `== 0` on
unfiltered files.

**Both-directions zod validation is a mechanical rule:** the router parses every inbound frame
against the client→daemon schema for its type AND validates every outbound payload against the
daemon→client schema before `send`. An outbound frame the daemon itself cannot validate is a bug
surfaced at source, not at Lane E's parser.

**Smoke = in-process daemon + REAL socket:** `startDaemon({ config, ... })` returns `{ port,
close }`; the smoke client dials `ws://127.0.0.1:<port>` with the real header. Full network
round-trip, no child-process fragility, no port collision (port 0).
</specifics>

<deferred>
## Deferred Ideas (register in SUMMARY as backlog candidates)

- Sessions/PTY (`apps/daemon/src/sessions/**`) — Lane E, phase 67. The seam ships tonight.
- Remote tunnel / "from anywhere" transport — explicitly banned tonight (LANE-CONTRACTS.md).
- Registry table as live runtime storage + web allowlist panel — SCHEMA-REQUEST.md tonight.
- Binary content in fs.read/fs.write (utf8-only tonight, size-capped).
- Full child process TREE kill guarantees beyond `taskkill /T /F` best-effort; job objects.
- Multi-folder watch; watch filters/globs.
- WSS/TLS, origin checks beyond the header-auth property, rate limiting (localhost-only tonight).
- Browser panel (CDP), directory panels, embedded editor — v2.0 epic breadth, not this slice.
</deferred>
