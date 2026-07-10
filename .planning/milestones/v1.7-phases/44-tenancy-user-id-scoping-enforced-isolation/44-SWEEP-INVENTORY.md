# Phase 44 Sweep Inventory — TENA-03

**Purpose:** Enumerate every route/procedure across the tRPC routers, the FastAPI
user-scoped endpoints, and the apps/web routes, with its scoping mechanism,
whether it requires authentication, and the test file that locks its
tenancy contract. Written at Plan 44-08 (the phase's adversarial acceptance
gate) per ROADMAP SC3.

**Scope note:** "FastAPI user-scoped endpoints" means routes that read/write
data belonging to a specific user (importer-anchored or direct `user_id`).
FastAPI routes that are NOT user-owned by design (webhook ingestion,
installation-wide entity-type system-CRUD reached only via `X-API-Key`, the
genui generate/code-island/history endpoints reached ONLY via the tRPC layer
above, which already re-derives scope web-side) are out of this table's
boundary — the tRPC row for the corresponding client-facing procedure is the
enforcement point of record for those.

**Legend:** Y = requires authentication before any data access. **GAP** =
authentication/ownership is NOT enforced today (see "Known Gap" section).
N = no per-user scoping needed (not user-owned data).

---

## tRPC routers (`packages/api-client/src/root.ts`)

### `emails` router (`packages/api-client/src/router/emails/`)

| Procedure | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `emails.list` | `userOwnedImporterIds` + `resolveListScope` | Y | `emails-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `emails.byId` | `assertEmailOwnership` | Y | `emails-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `emails.detail` | `assertEmailOwnership` | Y | `emails-user-scoping.test.ts` |
| `emails.entitySummary` | `EmailComponents.importerId` scoped against owned set (batch) | Y | `emails-user-scoping.test.ts` |
| `emails.accept` | `assertComponentOwnership` | Y | `emails-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `emails.reject` | `assertComponentOwnership` | Y | `mutations.test.ts` (wiring), covered by the shared `protectedProcedure` gate proven on `accept`/`merge`/`nest` |
| `emails.redraw` | `assertComponentOwnership` | Y | `mutations.test.ts` |
| `emails.split` | `assertComponentOwnership` | Y | `mutations.test.ts` |
| `emails.merge` | `assertComponentOwnership` (every referenced id) | Y | `emails-user-scoping.test.ts` |
| `emails.nest` | `assertComponentOwnership` (componentId + parentComponentId) | Y | `emails-user-scoping.test.ts` |
| `emails.createRegion` | `assertEmailOwnership` | Y | `mutations.test.ts` |
| `emails.classifyDocument` | `assertComponentOwnership` | Y | `mutations.test.ts` |
| `emails.autofillComponent` | `assertComponentOwnership` | Y | `mutations.test.ts` |
| `emails.confirmComponent` | `assertComponentOwnership` | Y | `mutations.test.ts` |
| `emails.reprocessEmail` | `assertEmailOwnership` | Y | `emails-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `emails.setRole` | `assertComponentOwnership` | Y | `component-relationship-mutations.test.ts` |
| `emails.setEntityType` | `assertComponentOwnership` | Y | `component-relationship-mutations.test.ts` |
| `emails.setFieldRelationship` | `assertComponentOwnership` (componentId + optional parentComponentId) | Y | `component-relationship-mutations.test.ts` |
| `emails.autofillFields` | `assertComponentOwnership` | Y | `component-relationship-mutations.test.ts` |
| `emails.denyField` | `assertComponentOwnership` | Y | `component-relationship-mutations.test.ts` |
| `emails.confirmField` | `assertComponentOwnership` | Y | `component-relationship-mutations.test.ts` |

### `entities` router (`packages/api-client/src/router/entities/`)

| Procedure | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `entities.list` | `userOwnedImporterIds` + `resolveListScope` | Y | `entities-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `entities.byId` | `assertImporterOwnership` (post-load) | Y | `entities-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `entities.confirmMerge` | `assertEntityInstanceOwned` (BOTH `entityInstanceId` + `targetId`) | Y | `entities-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `entities.rejectMerge` | `assertEntityInstanceOwned` (both ids) | Y | `mutations.test.ts` (same gate as `confirmMerge`) |
| `entities.unmerge` | `assertEntityInstanceOwned` | Y | `entities-user-scoping.test.ts` |

### `entityTypes` router (`packages/api-client/src/router/entity-types.ts` + `entity-types-write.ts`)

| Procedure | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `entityTypes.list` | `userOwnedImporterIds` — NULL-importer system defaults UNION owned overrides | Y | `entity-types-write.test.ts`, `cross-tenant-adversarial.test.ts` |
| `entityTypes.create` | FORBIDDEN outright (system defaults are seed-only, T-44-06-04) | Y | `entity-types-write.test.ts` |
| `entityTypes.update` | `assertEntityTypeWritable` (NULL importer → FORBIDDEN; foreign → NOT_FOUND) | Y | `entity-types-write.test.ts`, `cross-tenant-adversarial.test.ts` |
| `entityTypes.createField` | `assertEntityTypeWritable` | Y | `entity-types-write.test.ts` |
| `entityTypes.updateField` | `assertFieldWritable` (owning type's importer) | Y | `entity-types-write.test.ts` |
| `entityTypes.deleteField` | `assertFieldWritable` | Y | `entity-types-write.test.ts` |
| `entityTypes.reorderFields` | `assertEntityTypeWritable` | Y | `entity-types-write.test.ts` |

### `knowledge` router (`packages/api-client/src/router/knowledge/`)

**Note:** this router has NO write mutation. The only WRITE surface for
`knowledge_node_edges` is the FastAPI promote endpoint
(`POST /v1/knowledge/edges/{id}/promote`), which is never proxied through
`packages/api-client` — see the FastAPI table below and
`apps/email-listener/tests/adversarial/test_cross_tenant.py` for its
adversarial coverage (Plan 08 Task 2).

| Procedure | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `knowledge.list` | `userOwnedImporterIds` + `resolveListScope` | Y | `knowledge-user-scoping.test.ts` |
| `knowledge.graph` | Owned-importer derivation; system-default taxonomy preserved (NULL-importer OR-branch); D-11 explicit-edge union bounded via the source node's importer | Y | `knowledge-user-scoping.test.ts` |
| `knowledge.byId` | `assertImporterOwnership` (post-load) | Y | `knowledge-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `knowledge.expandNode` | Seed-node `assertImporterOwnership` BEFORE expansion (T-44-06-03) | Y | `knowledge-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |

### `chat` router (`packages/api-client/src/router/chat/`)

| Procedure | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `chat.createConversation` | Writes `user_id = ctx.user.id` directly (never client-supplied) | Y | `chat-user-scoping.test.ts` |
| `chat.listConversations` | Direct `eq(chat_conversations.user_id, ctx.user.id)` filter | Y | `chat-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `chat.renameConversation` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `chat.deleteConversation` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts` |
| `chat.setModel` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts` |
| `chat.getHistory` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts`, `cross-tenant-adversarial.test.ts` |
| `chat.sessionCost` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts` |
| `chat.recordBrowserTurn` | `assertConversationOwnership`; `chat_cost_ledger.user_id` written from `ctx.user.id` | Y | `chat-user-scoping.test.ts` |
| `chat.getCanvasLayout` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts` |
| `chat.saveCanvasLayout` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts` |
| `chat.getWidgetInteractions` | `assertConversationOwnership` | Y | `chat-user-scoping.test.ts` |
| `chat.models` | Not user-owned — public curated model registry (`publicProcedure`) | N | No tenancy test needed (no per-user data) |

### `genui` router (`packages/api-client/src/router/genui/`)

| Procedure | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `genui.generate` | `protectedProcedure` — AUTH-GATE ONLY. The exact-match generation cache is DELIBERATELY cross-tenant (SC5) — cache hits across users are the intended behavior, never ownership-denied | Y (auth only, by design) | `generate.test.ts`, `cross-tenant-adversarial.test.ts` |
| `genui.codeIslandGenerate` | `protectedProcedure` — same auth-gate-only posture as `generate` | Y (auth only, by design) | `code-island.test.ts` |
| `genui.historyList` | `userOwnedImporterIds` + `resolveListScope`, fans out one FastAPI call per owned importer (never omits `importer_id`, closes backlog 999.1) | Y | `history.test.ts`, `cross-tenant-adversarial.test.ts` |
| `genui.historyById` | Direct Drizzle `ui_spec_templates.importer_id` ownership check (NULL or foreign → NOT_FOUND) — a parallel lookup since the FastAPI detail view carries no `importer_id` | Y | `history.test.ts`, `cross-tenant-adversarial.test.ts` |

**genui cache tables — deliberately unscoped (SC5):** `genui_generation_events`
and `ui_spec_templates` (for exact-match CACHE HITS specifically, as opposed
to the history-browsing surface above, which IS scoped) carry no `user_id`
and are intentionally readable/reusable cross-tenant — this is the design,
not a gap. Documented in schema comments and PROJECT.md's Key Decisions
(`v1.7 Phase 44: genui_generation_events and ui_spec_templates stay
deliberately unscoped`).

---

## apps/web routes (`apps/web/src/app/api/`)

| Route | Scoping mechanism | Auth | Locking test |
|---|---|---|---|
| `GET /api/attachments/[id]` | `getUser()` (401) + `assertImporterOwnership` (404) | Y | `route.test.ts`, `cross-tenant.test.ts` |
| `POST /api/knowledge/edges/[edgeId]/promote` | `getUser()` (401) + forwards `X-User-Id` to the enforcing FastAPI promote endpoint | Y | Enforcement lives server-side — locked by `test_promote_edge_user_scoping.py`, `test_promote_edge_endpoint.py`, `test_cross_tenant.py` |
| `POST /api/chat/stream` | `getUser()` (401) + forwards `X-User-Id`; `require_user_id` + `ChatConversationRepository.owner_user_id` ownership assert (404 fail-closed) now enforced server-side | Y | `test_chat_sse_user_scoping.py` |
| `POST /api/chat/regenerate` | Same as `/api/chat/stream` | Y | `test_chat_sse_user_scoping.py` |
| `POST /api/chat/widget/submit` | Same pattern — `getUser()` (401) + forwards `X-User-Id`; FastAPI now enforces ownership + threads `user_id` into `PromoteEdgeUseCase.execute` | Y | `test_chat_sse_user_scoping.py` |
| `ALL /api/trpc/[trpc]` | tRPC catch-all — delegates to the per-procedure `protectedProcedure` gates enumerated above | Y (per-procedure) | Covered by every tRPC router test above |

---

## FastAPI user-scoped endpoints (`apps/email-listener`)

Every endpoint below also requires `X-API-Key` (`require_api_key`, the
installation-wide service boundary) — the tenancy layer is additive on top.

| Endpoint | Scoping mechanism | Auth (`X-User-Id`) | Locking test |
|---|---|---|---|
| `GET /v1/emails` (list) | `require_user_id` + `list_importer_ids_for_user` (never a raw query-param `importer_id`) | Y | `test_emails_user_scoping.py`, `test_cross_tenant.py` |
| `GET /v1/emails/{id}` (detail) | `require_user_id` + `_assert_importer_owned` (404, fail-closed) | Y | `test_emails_user_scoping.py`, `test_cross_tenant.py` |
| `GET /v1/emails/{id}/attachments/{id}` (download) | `require_user_id` + `_assert_importer_owned` (404) | Y | `test_emails_user_scoping.py`, `test_cross_tenant.py` |
| `POST /v1/emails/{id}/reprocess` | `require_user_id` + `_assert_importer_owned` (404) | Y | `test_emails_user_scoping.py`, `test_cross_tenant.py` |
| `POST /v1/knowledge/edges/{id}/promote` | `require_user_id` + `PromoteEdgeUseCase`'s user-ownership guard (409 `tenant_mismatch` when the caller doesn't own the edge's importer, checked BEFORE the pre-existing body-`importer_id` equality guard) | Y | `test_promote_edge_user_scoping.py`, `test_promote_edge_endpoint.py`, `test_cross_tenant.py` |
| `POST /v1/chat/stream` | `require_user_id` + `assert_conversation_owned` (via `ChatConversationRepository.owner_user_id`) — 404 fail-closed BEFORE the stream opens | Y | `test_chat_sse_user_scoping.py`, `test_chat_stream.py` |
| `POST /v1/chat/regenerate` | Same as above | Y | `test_chat_sse_user_scoping.py`, `test_chat_stream.py` |
| `POST /v1/chat/widget/submit` | `require_user_id` + `assert_conversation_owned` BEFORE `prepare()`. The `confirm_action` dispatch path now threads `user_id` into `PromoteEdgeUseCase.execute(user_id=...)`, activating the 44-03 `tenant_mismatch` guard on this path | Y | `test_chat_sse_user_scoping.py` |

---

## Known Gap — CLOSED by Plan 44-09 (the FastAPI chat SSE surface)

**Status: CLOSED.** Discovered at Plan 44-08's sweep, closed at Plan 44-09.

`POST /v1/chat/stream`, `POST /v1/chat/regenerate`, and
`POST /v1/chat/widget/submit` are the three FastAPI endpoints backing the
chat turn engine (`RunChatTurn.run()`/`.regenerate()`) and the widget
confirm/reject round-trip (`SubmitWidgetInteraction.prepare()`). Before Plan
44-09 all three were reachable via `X-API-Key` (`require_api_key`) alone —
no `require_user_id` dependency — and keyed exclusively off a client-supplied
`conversation_id` (Pydantic-validated as a UUID, but never checked against
any caller identity), even though the Next.js BFF proxying routes
(`apps/web/src/app/api/chat/{stream,regenerate}/route.ts`,
`apps/web/src/app/api/chat/widget/submit/route.ts`) already resolved the
caller via server-verified `supabase.auth.getUser()` and forwarded
`X-User-Id` on every request.

**Original exploit path (retained for provenance):** an attacker holding
another user's `conversation_id` (leaked via logs, a shared link, browser
history, or any out-of-band channel — this project's own established bar
already rejects "hard to guess" as a defense, see the attachments-route IDOR
fixed in Plan 07) could, under their own session:

1. `POST /v1/chat/stream` with that `conversation_id` — append a message
   into the victim's conversation and stream back a model response
   generated from the VICTIM's full conversation history (cross-tenant READ
   of conversation context + WRITE of a message into it).
2. `POST /v1/chat/regenerate` similarly, keyed by `conversation_id` +
   `assistant_message_id`.
3. `POST /v1/chat/widget/submit` for a pending `confirm_action` widget in
   that conversation — the narrower item originally carried forward across
   Plans 03/07: `_dispatch_confirm_action` resolved `importer_id` from the
   edge itself (never from a caller-verified value), so
   `PromoteEdgeUseCase`'s pre-existing tenant-mismatch check was a tautology
   on this path and its optional `user_id` guard (built in Plan 03
   specifically for this future use) never ran — the promotion succeeded
   regardless of who was calling.

**How it was closed (Plan 44-09):** (1) `ChatConversationRepository` gained
an `owner_user_id` ownership-lookup method (Protocol + Supabase impl); (2)
`Depends(require_user_id)` + a pre-stream `assert_conversation_owned` (404
fail-closed, mirrors `emails.py`'s `_assert_importer_owned`) were added to
all three endpoints, running BEFORE any `StreamingResponse` is constructed —
required because `run()`/`.regenerate()`/`prepare()` are lazy async
generators that don't execute their bodies until iterated; (3) the caller's
`user_id` is threaded through `SubmitWidgetInteraction.prepare()` →
`_dispatch_confirm_action` → `ConfirmActionHandler.execute()` →
`KnowledgeEdgeTierPromotionHandler.execute()` →
`PromoteEdgeUseCase.execute(user_id=...)`, finally activating the 44-03
`tenant_mismatch` guard on the chat confirm_action path.

**Locked by tests:** `apps/email-listener/tests/adversarial/
test_chat_sse_user_scoping.py` (renamed from
`test_chat_widget_submit_known_gap.py`) now asserts the ENFORCED contract
directly — zero `xfail` markers remain. Ten tests cover: 401-without-header,
404-for-non-owner, and a 200 positive-control for each of the three
endpoints, plus a focused unit test proving
`KnowledgeEdgeTierPromotionHandler.execute` forwards `user_id` into
`PromoteEdgeUseCase.execute`.

---

## Full tenancy test-suite confirmation

Run at Plan 44-08 completion:

- `cd packages/api-client && npx vitest run` → **27 files / 327 tests, all green**
  (26 pre-existing files/301 tests from Plans 05-07 + this plan's
  `cross-tenant-adversarial.test.ts`, 26 tests).
- `cd apps/web && npx vitest run` → **40 files / 294 tests, all green**
  (39 pre-existing files/292 tests + this plan's `cross-tenant.test.ts`, 2 tests).
- `cd apps/email-listener && uv run pytest tests/adversarial tests/presentation/api/v1 tests/application --no-cov` →
  **230 passed, 4 xfailed (the known-gap suite above), zero unexpected failures.**
- `cd apps/email-listener && uv run pytest --no-cov` (full suite) →
  **1248 passed, 9 skipped (pre-existing credential-gated), 4 xfailed, zero unexpected failures.**
- `npx tsc --noEmit` in `packages/api-client` and `apps/web` (excluding the
  pre-existing `apps/web/src/app/dev/design` baseline) → **zero errors** in
  both.

Every user-owned surface in the tables above shows an enforcement mechanism
AND a locking test, with exactly one explicitly-flagged open exception (the
chat SSE surface, documented above — not silently omitted) and one
deliberately-accepted-by-design exception (the genui generation cache, SC5).
