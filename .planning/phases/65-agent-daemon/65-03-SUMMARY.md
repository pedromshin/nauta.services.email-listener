---
phase: 65-agent-daemon
plan: 03
subsystem: daemon-server
tags: [websocket, security, auth, watcher, tool-executor, capability-registry]
requires: [65-01, 65-02]
provides:
  - "startDaemon() — WS server on 127.0.0.1 with upgrade-time token auth"
  - "the router seam Lane E registers session.* handlers through"
  - "the ToolExecutor as a capability registry (fs/terminal/git), resolved by id"
  - "chokidar watcher -> fs.watch.event broadcast"
  - "scripts/smoke.ts — 37 end-to-end proofs over a real socket"
affects: [lane-e-67-sessions, phase-68-capabilities]
tech-stack:
  added: []
  patterns:
    - "auth at the HTTP upgrade, not the connection handler"
    - "capability registry: resolution by id lookup, never a switch"
    - "shell:false always — no shell means no injection, rather than escaping"
key-files:
  created:
    - apps/daemon/src/server/auth.ts
    - apps/daemon/src/server/clients.ts
    - apps/daemon/src/server/router.ts
    - apps/daemon/src/server/ask.ts
    - apps/daemon/src/server/daemon.ts
    - apps/daemon/src/watch/watcher.ts
    - apps/daemon/src/types/ws-shim.d.ts
    - apps/daemon/src/index.ts
    - apps/daemon/src/tools/registry.ts
    - apps/daemon/src/tools/capabilities.ts
    - apps/daemon/src/tools/spawn.ts
    - apps/daemon/src/tools/handler.ts
    - apps/daemon/scripts/smoke.ts
    - apps/daemon/src/__tests__/auth.test.ts
    - apps/daemon/src/__tests__/router.test.ts
    - apps/daemon/src/__tests__/watcher.test.ts
    - apps/daemon/src/__tests__/tools.test.ts
    - .planning/phases/65-agent-daemon/SCHEMA-REQUEST.md
  modified: []
decisions:
  - "Tasks 3 (ToolExecutor) and 4 (smoke) were RECONSTRUCTED — 65-03-PLAN.md is truncated mid-Task-1"
  - "the capability registry conforms EXACTLY to the INV-1/INV-3 descriptor field names"
  - "an unknown tool id is refused by the protocol union before the registry (defense in depth)"
deps:
  - "apps/daemon: @types/ws ^8 — the ONLY absent package (ws-shim.d.ts must be DELETED in the same commit that installs it)"
metrics:
  duration: ~75min
  completed: 2026-07-17
requirements: [DMON-01, DMON-03, DMON-04, DMON-05, DMON-06]
---

# Phase 65 Plan 03: The Server, the ToolExecutor, and the Smoke Proof

The daemon now boots on this Windows PC, serves the frozen protocol behind an upgrade-time token
gate bound to loopback, executes fs/terminal/git through the ONE permission model, watches the
configured folder, and proves all of it end-to-end via a real socket.

**155 unit tests + 37 smoke proofs green. `tsc --noEmit` clean.**

## ⚠ Plan integrity: 65-03-PLAN.md is TRUNCATED

The plan file ends **mid-`<verify>` of Task 1** (line 258 of 258) — no Task 2, no
`<verification>`, `<success_criteria>`, or `<output>` section. This matches
`DIRECTIVES-2026-07-17.md`'s note that a planning agent died mid-write. There is also **no
65-04-PLAN.md**, although 65-02's plan text repeatedly forward-references "65-04" as the owner of
the ToolExecutor (`tool.request` "is left UNREGISTERED — 65-04 registers it").

**What I executed, and why:**

| Task | Source | Rationale |
|---|---|---|
| 1 — the door (auth/clients/router/ask/daemon/shim) | **As written in the plan** | — |
| 2 — watcher + index.ts | **Reconstructed** from the plan's `files_modified` + its complete `<interfaces>` block for both files | The interfaces fully specify them; DMON-04 is a phase requirement |
| 3 — the ToolExecutor + registry | **Reconstructed** | DMON-03 is a phase requirement, LANE-CONTRACTS.md row C names it in the slice, and the task brief made it the D2 spine. Without it the daemon has no executor at all and the slice is not a slice. |
| 4 — `scripts/smoke.ts` | **Reconstructed** | DMON-06; "a tiny CLI smoke script proves each capability" is explicit in the slice definition |

I did **not** invent scope beyond the phase's stated requirements (DMON-01..06) and the lane
contract's row C. Everything reconstructed traces to a requirement that already existed.

## What is USABLE end-to-end — and what it is NOT

**Usable today, for real:**
- `DAEMON_TOKEN=<32 hex> npx tsx src/index.ts` starts the daemon on this PC. It refuses to boot
  without a token, without a ≥16-char token, or without a valid config — all verified by running it.
- A WS client with the right header can: list sessions (empty), read/write/list files inside the
  configured roots, run executables with argument arrays, run safe git subcommands, and receive
  live `fs.watch.event`s — each gated by the ONE permission model, each remembered decision
  surviving a restart.
- `npm run smoke -w @polytoken/daemon` proves every one of those, plus the five negative proofs,
  in ~20s.

**NOT usable for (stated plainly, per the second amendment):**
- **Long-running capabilities driven from chat.** The agent loop cancels the run when the client
  disconnects (`chat_stream.py:131-164`), so run lifetime == browser tab lifetime. A daemon-backed
  Playwright/long-terminal capability would die on tab close today — independent of this daemon.
  That is run-decoupling work (Phase 69/72 territory), not something this slice can claim.
- **Anything over ~10s or ~2000 chars of output through the agent loop.** The loop's 10s tool
  timeout and ~2000-char output cap sit UPSTREAM of the daemon. The daemon's own limits are far
  higher (600s max, 1 MiB default), so a browser/terminal capability invoked through chat would be
  cut by the loop long before the daemon's bounds engage.
- **Remote/"from anywhere" access.** Loopback only, deliberately; tunneling is explicitly banned
  tonight.
- **Sessions/PTY** — Lane E's, phase 67. C ships the seam only.

Honest summary: **the daemon executes tools correctly, safely, and provably. Wiring it to chat as
a long-running capability awaits run-decoupling.**

## The D2 / capability-registry seam (INV-1..INV-4)

**Does the descriptor conform to the frozen field names? YES — exactly. Phase 68 is an IMPORT, not
an adapt.**

`apps/daemon/src/tools/registry.ts`:

```ts
export type CapabilityDescriptor<TInput, TOutput> = {
  readonly id: string;            // stable registry id — THE resolution key, and the allowlist's key
  readonly input: ZodType<TInput>;
  readonly output: ZodType<TOutput>;
  readonly risk: Risk;            // INV-4: data, drives the ONE permission model's prompt
  readonly cost: CapabilityCost;  // "free"|"cheap"|"moderate"|"expensive" — nominal today
  readonly describe: string;      // human/LLM-readable purpose
  readonly source: CapabilitySource; // "builtin"|"external"  (INV-3, constant today)
  readonly trust: CapabilityTrust;   // "first-party"|"verified"|"claimed"|"unvetted" (INV-3)
  // ── daemon-side halves; become the generic parameter when lifted ──
  readonly scope: (input: TInput) => CapabilityScope;
  readonly execute: (input: TInput, ctx: ExecCtx) => Promise<TOutput>;
};
```

- **INV-2 (resolution by id):** `builtinRegistry.get(payload.tool)` — a Map lookup. There is **no
  switch on tool name anywhere** in the executor. Adding a capability is a registry entry.
- **INV-2 (allowlist keys on registry ids):** `PermissionRule.capabilityId`, an open string.
- **INV-4 (risk is data):** `handler.ts` reads `capability.risk` and hands it to the broker. The
  one input-dependent case (git: status reads, commit writes) derives via `gitRiskFor(subcommand)`
  — a pure function that lives **with the capability**, not at the call site.
- **The outward view (INV-3 / v2.3):** `registry.list()` returns a projection carrying
  id/describe/risk/cost/source/trust and **no `execute`** — the registry pointed outward, ready to
  populate rather than re-architect.

### 🔴 A REAL Phase 68 constraint the smoke run surfaced

The frozen protocol's `toolRequestSchema` is a **closed discriminated union** over the five
builtin tool names. So an unknown capability id is refused by the **protocol** (`protocol_error`)
before it ever reaches the registry. That is correct defense-in-depth — two independent closed
sets — **but it means a `source: "external"` capability cannot be invoked over the frozen wire
until `toolRequestSchema` is widened (an additive protocol change).**

The registry is ready for external capabilities. **The wire is not, by design.** Phase 68 must
plan that widening explicitly; it is a protocol amendment, and Lane E consumes that schema.

### Where the seam is (for the lift)

The descriptor's METADATA half has **zero daemon coupling** — it is zod + plain strings, liftable
verbatim. The only daemon-private parts are `execute`'s `ExecCtx` (`{ maxOutputBytes,
defaultTimeoutMs }`) and `scope()`. When this moves to `packages/capabilities`, `ExecCtx` becomes
the generic parameter. `createCapabilityRegistry` / `defineCapability` / `CapabilityManifestEntry`
lift unchanged.

## Verification performed (exercised, never asserted)

**Real boots on this PC** (not a mock):
- no `DAEMON_TOKEN` → refuses, exit 1, actionable message, token absent from output
- `DAEMON_TOKEN=tiny` → refuses (<16 chars), exit 1
- valid token, no config → names the exact expected config path, exit 1
- valid token + config → `[daemon] listening on ws://127.0.0.1:59167 · roots=1 · watching …`

**Smoke: 37/37, exit 0** (`npx tsx scripts/smoke.ts`), including every negative proof:
wrong token rejected · missing token rejected · outside-roots denied with **no prompt** and the
secret never on the wire · `..\` traversal denied · injection string returned as literal data with
**no side effect** · runaway process killed at timeout · `git add ..\outside` denied · allowlist
survives restart and is honored **with auto-approve OFF** (a re-ask would have hung the request).

**Mutation checks — every load-bearing claim was proven able to FAIL:**

| Mutation | Result |
|---|---|
| 13th MsgType added to `MSG_TYPES` | **3 red** (65-01) |
| outside-roots check disabled | **4 red** (65-02) |
| upgrade auth gate disabled | **4 red** |
| bind changed to `0.0.0.0` | **2 red** (the LAN test really connects when exposed) |
| `shell: true` in safeSpawn | **6 red** |
| broker verdict ignored in handler | **7 red** |

## Deviations from Plan

**1. [Plan integrity] Tasks 2–4 reconstructed** — see the table above. The plan file is truncated.

**2. [Rule 1 — bug] The smoke script's own assertions were wrong twice, and running it caught both**
- *"unknown tool id → not_implemented"*: actually `protocol_error`, because the protocol union
  closes first. The **code was right; my assertion was wrong.** Corrected, and the finding is now
  a documented Phase 68 constraint (above).
- *"watcher names the file"*: the check was reading the FIRST `fs.watch.event`, which was
  `.git/description` from the `git init` two sections earlier — a race, not a watcher bug. It now
  waits for its own file. This is exactly the class of bug that "green because it asserted the
  wrong thing" produces.

**3. [Known platform limit — NOT fixed, deliberately] `process.on("SIGINT")` is unprovable on Windows**
- `index.ts` installs SIGINT/SIGTERM → `handle.close()` → exit 0. It is correct for the real case
  (Ctrl+C in a console, which Node emulates).
- **It cannot be verified programmatically:** Windows has no real signals — `child.kill("SIGINT")`
  maps to `TerminateProcess`, so the handler never runs (measured: `signal=SIGINT`, `code=null`,
  handler did not run). This is a documented Node/Windows limitation, not a code defect.
- **Why this is acceptable rather than a hole:** abrupt termination is already the design
  assumption. Allowlist writes are atomic (`tmp`+`rename`) and the audit log is append-only, so a
  hard-killed daemon cannot corrupt state. Graceful `close()` is separately proven (idempotent,
  refuses connections after close, no open handles).
- Also observed: `timeout -s INT` cannot stop `npx tsx` at all — the signal dies in the wrapper
  chain. Worth knowing for any future script that tries to manage the daemon's lifetime.

**4. [Rule 3] `handle.address` and `handle.ask` added to `DaemonHandle`**
- The plan's interface had neither. `address` is needed to PROVE the loopback bind rather than
  assume it; `ask` lets the smoke script and tests drive the permission loop directly. Both are
  additive.

**5. [Rule 2] `git add` refuses blanket staging; pathspecs are boundary-checked**
- Not in the plan. A daemon that can run `git add -A` can commit a secret by accident, and
  `git add ..\outside\secret.txt` would otherwise stage a file outside the roots. Both now
  refuse, with tests.

## Notes for the orchestrator (ACTION REQUIRED at merge)

1. **`@types/ws ^8` is the only absent dep — install it, and DELETE
   `apps/daemon/src/types/ws-shim.d.ts` in the SAME commit.** Both present = duplicate
   declarations = `tsc` fails. (R-10.)
2. **Add `"apps/daemon"` to the root `package.json` `workspaces` array** (currently
   `["packages/*", "apps/web"]`). `packages/daemon-protocol` needs no action — the `packages/*`
   glob covers it.
3. **Everything else is already hoisted** — `ws`, `chokidar`, `zod`, `tsx`, `typescript`,
   `vitest`, `@types/node`. No other installs.
4. `apps/daemon/vitest.config.ts`'s alias stays correct post-merge; deleting it is optional, not
   required.
5. **No nav/router wiring needed** — the daemon is a separate process with no web surface.
6. **`SCHEMA-REQUEST.md` is prose only.** No drizzle-kit was run. Three tables requested
   (`daemon_capabilities`, `daemon_permission_rules`, `daemon_audit_events`), all with `user_id`.
   **Nothing in this slice depends on them** — the file store is the runtime source of truth.
7. **Lane E is unblocked:** `apps/daemon/src/sessions/` does not exist; `session.list` is
   registered and honest; other `session.*` answer `not_implemented`; `router.register` is the
   seam.

## Deferred (backlog candidates, enumerated not faked)

- Widening `toolRequestSchema` for external capabilities (Phase 68 — see the constraint above).
- Full process TREE-kill guarantees beyond best-effort `taskkill /T /F`; job objects.
- Binary content in fs.read/fs.write (utf8-only, size-capped tonight).
- Multi-folder watch; watch filters/globs.
- WSS/TLS, rate limiting, origin checks beyond header auth (localhost-only tonight).
- Remote tunnel — explicitly banned tonight.
- The web allowlist panel + the registry table as live storage.

## Self-Check: PASSED

All 18 created files exist on disk. Commits 2db1eb0, 6c10000, 260237d, 79a3bf5 present in
`git log`. `tsc --noEmit` clean; 155 unit tests + 37 smoke proofs green.
