/**
 * apps/web/e2e/uat-41-knowledge-preview.spec.ts — Phase-41 UAT burn-down:
 * the `knowledge-preview` canvas node's five deferred visual/live-stack
 * scenarios (41.1-41.5), Phase 50 Plan 02 (LIVE-05).
 *
 * All five scenarios run against the LOCAL live stack via a seeded session
 * (apps/web/e2e/helpers/seed-session.ts) — no interactive Google. Each test
 * gets its OWN conversation + chat_canvas_layouts row (uat-chat-fixtures.ts's
 * `seedKnowledgeGraphFixture` seeds the shared, tier-diverse knowledge_nodes/
 * edges; the canvas-layout row placing the `knowledge-preview` node is this
 * spec's own responsibility since it needs a fresh per-test conversationId).
 * No live LLM calls are needed for any of these five scenarios (pure DOM/DB
 * — the knowledge-preview node reads knowledge_nodes/edges directly via
 * `knowledge.expandNode`, never the chat tool loop).
 *
 * 41.4 (viewport-center placement) was deferred across v1.3-v1.6 specifically
 * because "React Flow's live viewport transform... cannot be exercised
 * without a full React Flow instance and a live viewport" (41-HUMAN-UAT.md).
 * This spec now HAS a live viewport (a real Playwright browser) — it reads
 * `.react-flow__viewport`'s own CSS transform after panning and computes the
 * expected `screenToFlowPosition` result the same way the app itself does,
 * then DB/DOM-verifies the newly added node landed there (not at the origin).
 */

import path from "node:path";
import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import pg from "pg";

import { seedAuthenticatedContext } from "./helpers/seed-session";
import {
  KNOWLEDGE_PREVIEW_NODE_ID,
  requireEnv,
  seedKnowledgeGraphFixture,
  type SeedKnowledgeGraphFixtureResult,
} from "./helpers/uat-chat-fixtures";

loadDotenv({
  path: path.resolve(process.cwd(), "..", "..", ".env.local"),
  override: false,
});

const { Client } = pg;

const CHAT_MODEL_ID = "us.anthropic.claude-sonnet-4-6";
const NODE_REGISTRY_VERSION_FIXTURE = "uat41-fixture-v1";
const CHAT_NODE_X = 0;
const KP_NODE_X = 560;

async function assertNotLoginUrl(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requirePgUrl(): string {
  return requireEnv("POSTGRES_URL_NON_POOLING");
}

interface TestSetup {
  readonly dbClient: pg.Client;
  readonly userId: string;
  readonly fixture: SeedKnowledgeGraphFixtureResult;
}

/** Per-test setup: open a pg.Client, seed the authenticated session, and
 * seed the shared tier-diverse knowledge graph fixture (idempotent — safe
 * to call once per test). Caller is responsible for `dbClient.end()`. */
async function setupTest(context: BrowserContext): Promise<TestSetup> {
  const dbClient = new Client({ connectionString: requirePgUrl() });
  await dbClient.connect();
  const seeded = await seedAuthenticatedContext(context);
  const fixture = await seedKnowledgeGraphFixture(dbClient, seeded.userId);
  return { dbClient, userId: seeded.userId, fixture };
}

/**
 * seedConversationWithCanvasLayout — inserts a fresh conversation (own
 * random id + run-unique title, the 49-03 anti-race pattern) and a
 * chat_canvas_layouts row placing the D-02 default chat node plus one
 * `knowledge-preview` node pointed at `focusNodeId`. No `viewport` is
 * seeded (NULL) so React Flow's `fitView={!viewport}` auto-fits on first
 * mount, matching a real first-visit restore.
 */
async function seedConversationWithCanvasLayout(
  dbClient: pg.Client,
  userId: string,
  importerId: string,
  focusNodeId: string,
): Promise<{ readonly conversationId: string; readonly conversationTitle: string }> {
  const conversationId = randomUUID();
  const conversationTitle = `UAT-41 fixture ${conversationId.slice(0, 8)}`;

  await dbClient.query(
    `INSERT INTO chat_conversations (id, user_id, importer_id, title, model_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, userId, importerId, conversationTitle, CHAT_MODEL_ID],
  );

  const nodes = [
    {
      id: `chat:${conversationId}`,
      type: "chat",
      position: { x: CHAT_NODE_X, y: 0 },
      data: { conversationId },
    },
    {
      id: KNOWLEDGE_PREVIEW_NODE_ID,
      type: "knowledge-preview",
      position: { x: KP_NODE_X, y: 0 },
      data: { focusNodeId },
    },
  ];

  await dbClient.query(
    `INSERT INTO chat_canvas_layouts (id, conversation_id, nodes, edges, viewport, shared_state, node_registry_version)
     VALUES ($1, $2, $3::jsonb, '[]'::jsonb, NULL, '{}'::jsonb, $4)
     ON CONFLICT (conversation_id) DO UPDATE
       SET nodes = EXCLUDED.nodes, edges = EXCLUDED.edges, viewport = NULL, updated_at = now()`,
    [randomUUID(), conversationId, JSON.stringify(nodes), NODE_REGISTRY_VERSION_FIXTURE],
  );

  return { conversationId, conversationTitle };
}

/** Navigates to /chat, selects the conversation by its run-unique title, and
 * switches to Canvas view (D-02's Chat/Canvas segmented toggle). */
async function openCanvasView(page: Page, conversationTitle: string): Promise<void> {
  await page.goto("/chat");
  await assertNotLoginUrl(page);
  await page
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(conversationTitle)}`) })
    .click();
  await page.getByRole("tab", { name: "Canvas view" }).click();
  await expect(page.locator(`.react-flow__node[data-id="${KNOWLEDGE_PREVIEW_NODE_ID}"]`)).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("UAT 41: knowledge-preview canvas node (seeded session, DB/DOM-verified)", () => {
  // [Rule 1 - Bug] playwright.config.ts's repo-wide `fullyParallel: true`
  // races two independent things this spec depends on when its 5 tests run
  // concurrently: (1) GoTrue's magic-link mint+verify in seed-session.ts for
  // the SAME seed user — a concurrent generateLink/verifyOtp pair can
  // invalidate a sibling worker's in-flight link ("Email link is invalid or
  // has expired"); (2) Next.js dev-mode on-demand route compilation under
  // concurrent worker load (the exact class of flake 49-03 already
  // documented for --project sharding). Serial mode confines this file to
  // one worker, one test at a time — observed live during this plan's own
  // execution (2/5 tests failed under the default parallel config with the
  // magic-link race above; all 5 passed reliably across 4 consecutive
  // full-suite runs once serialized, after also fixing a real
  // `chat-canvas.tsx` restore-race bug and several test-selector bugs — see
  // 50-02-SUMMARY.md).
  test.describe.configure({ mode: "serial" });

  // -------------------------------------------------------------------
  // 41.1 — two-ring layout + tier styling (dashed=INFERRED, faint=AMBIGUOUS,
  // solid=EXTRACTED)
  // -------------------------------------------------------------------
  test("41.1: focus + 1-hop + 2-hop dots render with correct tier-styled edges", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    const { dbClient, userId, fixture } = await setupTest(context);
    try {
      const { conversationTitle } = await seedConversationWithCanvasLayout(
        dbClient,
        userId,
        fixture.importerId,
        fixture.focusNodeId,
      );

      await openCanvasView(page, conversationTitle);

      const kpNode = page.locator(`.react-flow__node[data-id="${KNOWLEDGE_PREVIEW_NODE_ID}"]`);

      // `knowledge.expandNode` resolves asynchronously — wait for the
      // success-branch dot group (not the loading skeleton) before reading
      // edges/dots, otherwise the query below can race the query settling.
      const dotGroup = kpNode.locator('[role="group"][aria-label="Related knowledge nodes"]');
      await expect(dotGroup).toBeVisible({ timeout: 10_000 });

      // 3 edges: focus->1hop-extracted, focus->1hop-inferred, 1hop-extracted->2hop-ambiguous.
      // [Rule 1 - Bug] scoped to the mini-graph's own 280x140 edge svg —
      // an unscoped `kpNode.locator("svg line")` also matches the header's
      // and the focus dot's Share2 lucide icons (each a 2-line svg), which
      // inflated the match count to 7 instead of the mini-graph's real 3.
      const lineAttrs = await kpNode.locator('svg[width="280"] > line').evaluateAll((elements) =>
        elements.map((el) => ({
          dasharray: el.getAttribute("stroke-dasharray"),
          opacity: el.getAttribute("opacity"),
        })),
      );
      // [Rule 1 - Bug] test-authoring bug: only 3 edges exist total (1 per
      // tier), so the "solid, full-opacity" filter can only ever match the
      // 1 EXTRACTED edge — there is no "other full-opacity edge" (the
      // INFERRED edge is also opacity 1, but it's dashed, already counted
      // by the dasharray==="5 3" filter above).
      expect(lineAttrs).toHaveLength(3);
      expect(lineAttrs.filter((a) => a.dasharray === "5 3")).toHaveLength(1); // INFERRED — dashed
      expect(lineAttrs.filter((a) => a.opacity === "0.45")).toHaveLength(1); // AMBIGUOUS — faint
      expect(lineAttrs.filter((a) => a.dasharray === null && a.opacity === "1")).toHaveLength(1); // EXTRACTED — solid, full opacity

      // 4 node dots: focus + 2 one-hop + 1 two-hop.
      // [Rule 1 - Bug] scoped to `a > span` (the dot wrapper, a DIRECT child
      // of the link) — the focus dot's own inner Share2 icon also carries a
      // `size-3` class (nested one level deeper, inside the size-5 wrapper
      // span), so an unscoped `.size-3` match inflated the 1-hop dot count.
      await expect(dotGroup.locator("a")).toHaveCount(4);
      await expect(dotGroup.locator("a > span.size-5")).toHaveCount(1); // focus dot
      await expect(dotGroup.locator("a > span.size-3")).toHaveCount(2); // 1-hop dots
      await expect(dotGroup.locator("a > span.size-2")).toHaveCount(1); // 2-hop dot
    } finally {
      await dbClient.end();
    }
  });

  // -------------------------------------------------------------------
  // 41.2 — tooltip hover behavior
  // -------------------------------------------------------------------
  test("41.2: hovering a mini-graph dot shows a tooltip with the full label, dismissing on mouse-leave", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    const { dbClient, userId, fixture } = await setupTest(context);
    try {
      const { conversationTitle } = await seedConversationWithCanvasLayout(
        dbClient,
        userId,
        fixture.importerId,
        fixture.focusNodeId,
      );

      await openCanvasView(page, conversationTitle);

      const kpNode = page.locator(`.react-flow__node[data-id="${KNOWLEDGE_PREVIEW_NODE_ID}"]`);
      const oneHopLabel = "UAT-41 One-Hop Extracted Neighbour";
      const dot = kpNode.getByRole("link", { name: `Open ${oneHopLabel} in Knowledge graph` });

      await dot.hover();
      const tooltip = page.getByRole("tooltip", { name: oneHopLabel });
      // Radix delayDuration=300ms — 5s tolerance for real scheduling jitter
      // (found live: a 2s budget occasionally missed the open under load).
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      // Mouse-leave. [Rule 1 - Bug] a SINGLE `mouse.move` call isn't enough:
      // Radix Tooltip's hoverable-content grace-area logic (see
      // node_modules/@radix-ui/react-tooltip TooltipContentHoverable) creates
      // its exit polygon on the trigger's `pointerleave` event, then only
      // evaluates "did the pointer leave the polygon" on a LATER `pointermove`
      // — the one synthetic move that CAUSES the pointerleave arrives too
      // late for its own polygon check. A second, tiny follow-up move fires
      // the extra `pointermove` the grace-area check needs to actually close.
      await page.mouse.move(5, 5);
      await page.mouse.move(6, 6);
      await expect(tooltip).not.toBeVisible({ timeout: 8_000 });
    } finally {
      await dbClient.end();
    }
  });

  // -------------------------------------------------------------------
  // 41.3 — add-preview popover open/close feel (Cancel / Add / outside-click)
  // -------------------------------------------------------------------
  test("41.3: add-preview popover validates, adds on success, and closes on Cancel/outside-click", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    const { dbClient, userId, fixture } = await setupTest(context);
    try {
      const { conversationTitle } = await seedConversationWithCanvasLayout(
        dbClient,
        userId,
        fixture.importerId,
        fixture.focusNodeId,
      );

      await openCanvasView(page, conversationTitle);

      const addButton = page.getByRole("button", { name: "Add knowledge preview" });
      const nodeIdInput = page.getByPlaceholder("Paste a node ID…");

      // -- Invalid id keeps the popover open with inline error copy --
      await addButton.click();
      await expect(nodeIdInput).toBeVisible();
      await nodeIdInput.fill("not-a-uuid");
      await page.getByRole("button", { name: "Add preview" }).click();
      await expect(page.getByText("Enter a valid knowledge node ID.")).toBeVisible();
      await expect(nodeIdInput).toBeVisible(); // still open

      // -- Valid id + label closes the popover and materializes a new node --
      await nodeIdInput.fill(fixture.oneHopExtractedId);
      await page.getByPlaceholder("Custom name for this preview").fill("UAT-41 Added Preview");
      await page.getByRole("button", { name: "Add preview" }).click();
      await expect(nodeIdInput).not.toBeVisible();

      const addedNodeFooterLink = page
        .locator(`a[href="/knowledge?focus=${fixture.oneHopExtractedId}"]`)
        .filter({ hasText: "Open in Knowledge" });
      await expect(addedNodeFooterLink).toBeVisible({ timeout: 10_000 });

      // -- Cancel discards the draft, adds nothing, closes the popover --
      const kpNodeCountBeforeCancel = await page
        .locator('.react-flow__node.react-flow__node-knowledge-preview')
        .count();
      await addButton.click();
      await expect(nodeIdInput).toBeVisible();
      await nodeIdInput.fill(fixture.oneHopInferredId);
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(nodeIdInput).not.toBeVisible();
      await expect(page.locator('.react-flow__node.react-flow__node-knowledge-preview')).toHaveCount(
        kpNodeCountBeforeCancel,
      );

      // -- Outside-click dismisses the popover --
      // [Rule 1 - Bug] a pane-relative (20, 20) click landed inside the
      // top-right `Panel` (the same "Add knowledge preview" button/minimap
      // toggle panel) rather than the empty pane background — clicking a
      // toolbar control isn't a genuine "outside click" test. Uses the
      // pane's own bounding box to click its bottom-center instead, clear of
      // both the top-right panel and React Flow's default bottom-left Controls.
      await addButton.click();
      await expect(nodeIdInput).toBeVisible();
      const paneBox = await page.locator(".react-flow__pane").boundingBox();
      if (paneBox === null) {
        throw new Error("uat-41-knowledge-preview.spec: could not read React Flow pane geometry");
      }
      await page.mouse.click(paneBox.x + paneBox.width * 0.5, paneBox.y + paneBox.height * 0.9);
      await expect(nodeIdInput).not.toBeVisible();
    } finally {
      await dbClient.end();
    }
  });

  // -------------------------------------------------------------------
  // 41.4 — new-node placement near the CURRENT viewport center (panned
  // canvas), not the origin. Previously undeferrable — now proven with a
  // live React Flow viewport transform.
  // -------------------------------------------------------------------
  test("41.4: adding a node while the canvas is panned places it near the current viewport center", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    const { dbClient, userId, fixture } = await setupTest(context);
    try {
      const { conversationTitle } = await seedConversationWithCanvasLayout(
        dbClient,
        userId,
        fixture.importerId,
        fixture.focusNodeId,
      );

      await openCanvasView(page, conversationTitle);

      const wrapperBox = await page.locator(".react-flow").boundingBox();
      const viewportSize = page.viewportSize();
      if (wrapperBox === null || viewportSize === null) {
        throw new Error("uat-41-knowledge-preview.spec: could not read React Flow wrapper geometry");
      }

      // Pan by dragging an empty corner of the pane (bottom-left, well clear
      // of the seeded chat/knowledge-preview nodes near the top).
      const startX = wrapperBox.x + wrapperBox.width * 0.1;
      const startY = wrapperBox.y + wrapperBox.height * 0.85;
      const dx = -220;
      const dy = -140;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 5 });
      await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
      await page.mouse.up();

      const viewportTransform = await page.locator(".react-flow__viewport").getAttribute("style");
      const match = viewportTransform?.match(
        /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([\d.]+)\)/,
      );
      if (!match) {
        throw new Error(
          `uat-41-knowledge-preview.spec: could not parse .react-flow__viewport transform: ${viewportTransform}`,
        );
      }
      const panX = Number.parseFloat(match[1]!);
      const panY = Number.parseFloat(match[2]!);
      const zoom = Number.parseFloat(match[3]!);

      // Mirrors handleAddKnowledgePreview's own
      // screenToFlowPosition({x: innerWidth/2, y: innerHeight/2}) call.
      const expectedFlowX = (viewportSize.width / 2 - wrapperBox.x - panX) / zoom;
      const expectedFlowY = (viewportSize.height / 2 - wrapperBox.y - panY) / zoom;

      await page.getByRole("button", { name: "Add knowledge preview" }).click();
      await page.getByPlaceholder("Paste a node ID…").fill(fixture.twoHopAmbiguousId);
      await page.getByRole("button", { name: "Add preview" }).click();
      await expect(page.getByPlaceholder("Paste a node ID…")).not.toBeVisible();

      const addedNode = page.locator('.react-flow__node.react-flow__node-knowledge-preview').filter({
        has: page
          .locator(`a[href="/knowledge?focus=${fixture.twoHopAmbiguousId}"]`)
          .filter({ hasText: "Open in Knowledge" }),
      });
      await expect(addedNode).toBeVisible({ timeout: 10_000 });

      const nodeStyle = await addedNode.getAttribute("style");
      const nodeMatch = nodeStyle?.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      if (!nodeMatch) {
        throw new Error(`uat-41-knowledge-preview.spec: could not parse added node transform: ${nodeStyle}`);
      }
      const actualX = Number.parseFloat(nodeMatch[1]!);
      const actualY = Number.parseFloat(nodeMatch[2]!);

      // Robust invariant (the acceptance bar): NOT at/near the canvas origin
      // after a deliberate, sizeable pan.
      const distanceFromOrigin = Math.hypot(actualX, actualY);
      expect(distanceFromOrigin, "expected the new node away from the canvas origin").toBeGreaterThan(150);

      // Precise invariant: within tolerance of the computed viewport-center
      // flow position (generous — accounts for CSS pixel rounding).
      expect(Math.abs(actualX - expectedFlowX)).toBeLessThan(160);
      expect(Math.abs(actualY - expectedFlowY)).toBeLessThan(160);
    } finally {
      await dbClient.end();
    }
  });

  // -------------------------------------------------------------------
  // 41.5 — remove-then-reload persistence round-trip (DB-verified, not just
  // local React Flow state)
  // -------------------------------------------------------------------
  test("41.5: removing a node then reloading keeps it gone (DB-persisted, not just local state)", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    const { dbClient, userId, fixture } = await setupTest(context);
    try {
      const { conversationId, conversationTitle } = await seedConversationWithCanvasLayout(
        dbClient,
        userId,
        fixture.importerId,
        fixture.focusNodeId,
      );

      await openCanvasView(page, conversationTitle);

      const kpNode = page.locator(`.react-flow__node[data-id="${KNOWLEDGE_PREVIEW_NODE_ID}"]`);
      await kpNode.getByRole("button", { name: "Remove knowledge preview" }).click();
      await expect(kpNode).toHaveCount(0);

      // Wait for the debounced (~800ms) chat.saveCanvasLayout to persist the
      // removal — poll the DB directly rather than a fixed sleep.
      await expect
        .poll(
          async () => {
            const result = await dbClient.query<{ nodes: unknown }>(
              "SELECT nodes FROM chat_canvas_layouts WHERE conversation_id = $1",
              [conversationId],
            );
            const nodes = (result.rows[0]?.nodes ?? []) as ReadonlyArray<{ id: string }>;
            return nodes.some((node) => node.id === KNOWLEDGE_PREVIEW_NODE_ID);
          },
          { timeout: 10_000, message: "waiting for the removal to persist to chat_canvas_layouts" },
        )
        .toBe(false);

      // Full reload — the round-trip through the DB, not local React Flow state.
      // [Rule 1 - Bug] `page.tsx`'s `selectedId` is plain `useState<string |
      // null>(null)` — NOT URL- or storage-backed — so a reload always lands
      // on the no-conversation-selected empty state. The conversation must be
      // re-selected (same as `openCanvasView`) before `.react-flow` can
      // possibly exist again; only the Chat/Canvas *view mode* itself is
      // localStorage-persisted per-conversation (`readStoredViewMode`), which
      // is why re-selecting alone (no extra "Canvas view" tab click) is
      // enough to land back on canvas view.
      await page.reload();
      await assertNotLoginUrl(page);
      await page
        .getByRole("button", { name: new RegExp(`^${escapeRegExp(conversationTitle)}`) })
        .click();
      await expect(page.locator(".react-flow")).toBeVisible({ timeout: 20_000 });
      await expect(kpNode).toHaveCount(0);

      const finalRow = await dbClient.query<{ nodes: unknown }>(
        "SELECT nodes FROM chat_canvas_layouts WHERE conversation_id = $1",
        [conversationId],
      );
      const finalNodes = (finalRow.rows[0]?.nodes ?? []) as ReadonlyArray<{ id: string }>;
      expect(finalNodes.some((node) => node.id === KNOWLEDGE_PREVIEW_NODE_ID)).toBe(false);
    } finally {
      await dbClient.end();
    }
  });
});
