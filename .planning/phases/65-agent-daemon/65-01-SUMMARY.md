---
phase: 65-agent-daemon
plan: 01
subsystem: daemon-protocol
tags: [protocol, zod, websocket, contract]
requires: []
provides:
  - "@polytoken/daemon-protocol — zod schemas + TS types for all 12 frozen MsgTypes"
  - "parseClientFrame / parseDaemonFrame — the both-directions validation surface"
affects: [lane-e-67-sessions, 65-02, 65-03]
tech-stack:
  added: []
  patterns: ["Result-shaped parsers (never throw)", "partial direction maps as a spoofing control", "contract fidelity pinned by transcribed literals"]
key-files:
  created:
    - packages/daemon-protocol/package.json
    - packages/daemon-protocol/tsconfig.json
    - packages/daemon-protocol/src/index.ts
    - packages/daemon-protocol/src/envelope.ts
    - packages/daemon-protocol/src/sessions.ts
    - packages/daemon-protocol/src/tools.ts
    - packages/daemon-protocol/src/perms.ts
    - packages/daemon-protocol/src/watch.ts
    - packages/daemon-protocol/src/direction.ts
    - packages/daemon-protocol/src/__tests__/protocol.test.ts
  modified: []
decisions:
  - "R-05 output union: kind-discriminated, incl. { kind: 'error', code, message }"
  - "toolNameSchema added (not in plan interfaces) — the shared tool-name enum 65-02's store needs"
deps:
  - "packages/daemon-protocol: zod ^3.25.0 (hoisted 3.25.76 already), devDeps typescript ^5.8.0 / vitest ^2.1.9"
metrics:
  duration: ~20min
  completed: 2026-07-17
requirements: [DMON-05]
---

# Phase 65 Plan 01: Daemon Protocol Summary

The frozen LANE-CONTRACTS.md WS protocol shipped as zod schemas + TS types for every envelope and
payload — including all `session.*` shapes Lane E consumes — pinned to the contract text by a
mutation-verified fidelity test.

## What is USABLE end-to-end

`@polytoken/daemon-protocol` is complete and consumable **right now**. Lane E can build /sessions
against these imports alone without reading a line of C's daemon source. `tsc --noEmit` clean,
38 tests green, zero installs (zod was already hoisted).

## Export list (verbatim — 65-02/65-03 and Lane E import against this)

**Values:**
```
MSG_TYPES, msgTypeSchema, envelopeSchema
sessionMetaSchema, sessionListRequestSchema, sessionListResponseSchema, sessionStartRequestSchema,
sessionAttachRequestSchema, sessionAttachResponseSchema, sessionOutputEventSchema,
sessionInputSchema, sessionResizeSchema, sessionExitEventSchema
fsWatchKindSchema, fsWatchEventSchema
riskSchema, gitSubcommandSchema, toolNameSchema, toolRequestSchema, toolErrorCodeSchema,
fsListEntrySchema, toolOutputSchema, toolResultSchema
permRequestSchema, permDecisionSchema
clientToDaemon, daemonToClient, parseClientFrame, parseDaemonFrame
```

**Types:**
```
MsgType, Envelope
SessionMeta, SessionListRequestPayload, SessionListResponsePayload, SessionStartRequestPayload,
SessionAttachRequestPayload, SessionAttachResponsePayload, SessionOutputEventPayload,
SessionInputPayload, SessionResizePayload, SessionExitEventPayload
FsWatchKind, FsWatchEventPayload
Risk, GitSubcommand, ToolName, ToolRequestPayload, ToolErrorCode, FsListEntry, ToolOutput,
ToolResultPayload
PermRequestPayload, PermDecisionPayload
ClientToDaemonType, DaemonToClientType, ParsedFrame, FrameFailure, FrameResult
```

**Helper signatures Lane E should use instead of hand-rolling parse sequences:**
```ts
parseClientFrame(raw: unknown): FrameResult<ClientToDaemonType>
parseDaemonFrame(raw: unknown): FrameResult<DaemonToClientType>
// FrameResult = { ok: true; envelope: Envelope; type; payload: unknown }
//             | { ok: false; id?: string; error: string }   // never throws
```

## Verification performed (not asserted — exercised)

- `npx tsc --noEmit` → clean.
- `npx vitest run` → 38/38 green.
- **Mutation check (the suite has teeth):** appending a 13th MsgType (`session.kill`) to
  `MSG_TYPES` turned **3 tests red**; restoring returned 38 green. The fidelity pin genuinely
  detects drift rather than passing vacuously.

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] Added `toolNameSchema` / `ToolName`**
- **Found during:** Task 1, cross-reading 65-02's `permissionRuleSchema`.
- **Issue:** 65-02's store types `tool` as `z.enum(["fs.read","fs.write","fs.list","terminal.exec","git"])`
  — a hand-copied duplicate of the discriminated union's tool set. Two sources of truth for the
  tool list is exactly the drift the protocol package exists to prevent.
- **Fix:** exported `toolNameSchema` from `tools.ts`; 65-02's store imports it.
- **Commit:** 6a8ef80

**2. [Rule 3 — blocking] Explicit `.js` extensions on internal imports**
- The plan's interfaces implied extensionless imports. `moduleResolution: bundler` tolerates
  either, but `tsx` runtime ESM resolution is happier with explicit specifiers, and 65-03 runs
  this code under `tsx`. Used `./x.js` throughout — resolves under both.

Otherwise executed exactly as written.

## Notes for the orchestrator

- **Workspace:** `packages/*` glob picks this package up at merge automatically. No root
  package.json edit needed for the protocol package (contrast `apps/daemon` — see 65-02/65-03).
- **deps to install at merge:** none new. zod/typescript/vitest already lockfile-pinned + hoisted.

## Self-Check: PASSED

All 10 created files exist on disk; commits 6a8ef80, 29791eb present in `git log`.
