/**
 * chat-frame-structure.test.tsx — 61-03-PLAN.md Task 3. The structural gate for
 * the three components 61-03 redesigned: the conversation rail, its rows, and
 * the composer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE TRUSTING A GREEN RUN: THIS FILE SEES NO LAYOUT.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * jsdom computes NO layout and runs NO cascade. It does not know what `h-full`
 * resolves to, whether a flex child overflows its parent, whether the rail is
 * 208px or 11,296px tall, or even that Tailwind exists. **A green run here is
 * not evidence that the frame renders.**
 *
 * The gate that CAN see those things is `npm run test:geometry` (61-01,
 * `e2e/surface-geometry.spec.ts`) — a real browser, real layout, driven against
 * the already-running dev server. It is the one that matters for this subtree:
 * when the rail's height chain broke (`e2a2abf`) the document scrolled to
 * 11,296px at a 900px viewport, the main pane read as empty, and **all 44 chat
 * suites / 363 tests passed before AND after**. They would have passed through
 * the next one too.
 *
 * So this file deliberately asserts only what a DOM without layout can honestly
 * know: which elements exist, what their class STRINGS say, and what their
 * accessible names are. Where it touches the height chain (Leg 6) it proves the
 * DECLARATION survives — never that it resolves. That distinction is the whole
 * reason both gates exist.
 *
 * A NOTE ON SHAPE, so nobody later "harmonizes" this with 61-02's gate:
 * `canvas-vocabulary.test.ts` is a semantic matrix over pure maps — no DOM at
 * all. This one mounts components. They are different instruments and neither
 * substitutes for the other, nor for the browser.
 *
 * THE SIX LEGS:
 *   1. SELECTION IS NOT A HUE — the class-string difference between a selected
 *      and an unselected row carries no tier or retired node-type token (law 1:
 *      "selected states carry NO hue"). Computed as a SET DIFFERENCE, mirroring
 *      60-04's "role is not colour" idiom.
 *   2. SELECTION IS LEGIBLE — selected and unselected produce DISTINCT class
 *      strings. Re-encoding selection is the goal; deleting it is not. Leg 1
 *      alone is trivially satisfiable by rendering nothing.
 *   3. THE COMPOSER IS ONE BUTTON — exactly one control carries the send/stop
 *      role across both `isStreaming` values, and its accessible name tracks the
 *      action (T-61-09).
 *   4. THE CLAMP SURVIVES — `MAX_TEXTAREA_HEIGHT_PX` is still applied and the
 *      field still scrolls internally (T-61-08, the layout-DoS guard).
 *   5. NO ELEVATION ON THE DOCK — the identity's "zero shadow anywhere", made
 *      executable for this surface.
 *   6. THE RAIL'S HEIGHT CHAIN IS DECLARED — every element from the rail body up
 *      to the tree root declares an explicit height. This is `e2a2abf`'s exact
 *      shape: ONE link in that chain silently lost its class.
 *
 * ON WRITING LITERALS IN THIS FILE: `role-hue-ban.test.ts` is a RATCHET whose
 * `SCOPED_DIRS` Phases 61-63 append their own roots to as they sweep — `chat/`
 * lands there in 61-04/61-05, and this file sits under it. That gate matches a
 * colour-utility PREFIX + the family, and it reads LINES, not prose. So the
 * banned families below are assembled at runtime and never written out, exactly
 * as that gate assembles its own.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

interface ListQueryResult {
  readonly data: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly modelId: string;
    readonly updatedAt: string;
  }> | undefined;
  readonly isLoading: boolean;
}

const CONVERSATION_A = "11111111-1111-1111-1111-111111111111";
const CONVERSATION_B = "22222222-2222-2222-2222-222222222222";

const FAKE_CONVERSATIONS = [
  { id: CONVERSATION_A, title: "Freight quote — Lote 88", modelId: "m1", updatedAt: "2026-01-02T00:00:00.000Z" },
  { id: CONVERSATION_B, title: "June spending recap", modelId: "m1", updatedAt: "2026-01-01T00:00:00.000Z" },
];

let listResult: ListQueryResult = { data: FAKE_CONVERSATIONS, isLoading: false };

vi.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      chat: { listConversations: { invalidate: vi.fn().mockResolvedValue(undefined) } },
    }),
    chat: {
      listConversations: { useQuery: () => listResult },
      renameConversation: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteConversation: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import { Composer } from "../composer";
import { ConversationRail } from "../conversation-rail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The retired node-type role family and the two tier families, assembled at
 * runtime — see the header note on `role-hue-ban.test.ts`'s ratchet.
 */
const BANNED_HUE_TOKENS: readonly string[] = [
  ["gra", "ph"].join(""),
  ["co", "nf"].join(""),
  ["su", "gg"].join(""),
];

let containers: HTMLDivElement[] = [];
let roots: Root[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return container;
}

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  for (const container of containers) container.remove();
  roots = [];
  containers = [];
  listResult = { data: FAKE_CONVERSATIONS, isLoading: false };
});

function railProps(selectedId: string | null) {
  return {
    selectedId,
    onSelect: vi.fn(),
    onDeleted: vi.fn(),
    collapsed: false,
    onCollapsedChange: vi.fn(),
    mobileOpen: false,
    onMobileOpenChange: vi.fn(),
    onNewChat: vi.fn(),
    creatingConversation: false,
  };
}

/** Every conversation row in a mounted rail, keyed on the row's own marker
 * rather than on a colour class — so this gate stays colour-blind about how it
 * FINDS things and only reads colour where it is deliberately asserting on it. */
function rows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-field="conversation-row"]'));
}

function rowByActive(container: HTMLElement, active: boolean): HTMLElement {
  const match = rows(container).find((el) => el.getAttribute("data-active") === String(active));
  if (!match) throw new Error(`no conversation row with data-active="${active}"`);
  return match;
}

/** `cn`/twMerge emits a space-separated class string; the set difference of the
 * two is "what selection actually changed". */
function classSet(el: HTMLElement): Set<string> {
  return new Set(el.className.split(/\s+/).filter(Boolean));
}

function difference(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((cls) => !b.has(cls));
}

describe("chat-frame-structure (SURF-02, 61-03) — jsdom sees no layout; test:geometry is the gate that does", () => {
  it("Leg 1: selection is NOT a hue — the selected/unselected class difference carries no tier or retired node-type token (law 1)", async () => {
    const container = await mount(<ConversationRail {...railProps(CONVERSATION_A)} />);

    const selected = classSet(rowByActive(container, true));
    const unselected = classSet(rowByActive(container, false));

    // BOTH directions: what selection ADDS, and what it REMOVES. A hue smuggled
    // in as "the unselected row is the one wearing the colour" is the same
    // violation wearing a mirror.
    const changed = [...difference(selected, unselected), ...difference(unselected, selected)];

    expect(changed.length, "selection changed no classes at all — see Leg 2").toBeGreaterThan(0);

    for (const cls of changed) {
      for (const family of BANNED_HUE_TOKENS) {
        expect(
          cls,
          `selection is stated with "${cls}", which carries a tier/retired-node-type family. ` +
            `Law 1: selected states carry NO hue — selection is FILL and WEIGHT ` +
            `(the sketch's .citem.on: --shade fill + ink text + font-semibold).`,
        ).not.toContain(family);
      }
    }
  });

  it("Leg 2: selection is LEGIBLE — selected and unselected render distinct class strings", async () => {
    const container = await mount(<ConversationRail {...railProps(CONVERSATION_A)} />);

    const selected = rowByActive(container, true).className;
    const unselected = rowByActive(container, false).className;

    // Leg 1 is trivially satisfiable by removing selection entirely. This is the
    // other jaw: re-encoding selection is the goal, deleting it is not.
    expect(
      selected,
      "the selected and unselected rows are styled identically — selection was deleted, not re-encoded",
    ).not.toBe(unselected);

    // And it is stated with WEIGHT, not fill alone — the half that was missing
    // pre-61-03, and the half that survives greyscale.
    expect(selected).toContain("font-semibold");
    expect(unselected).not.toContain("font-semibold");
  });

  it("Leg 3 (T-61-09): the composer is ONE button — one control across both states, its accessible name tracking the action", async () => {
    const idle = await mount(<Composer isStreaming={false} onSubmit={vi.fn()} onStop={vi.fn()} />);
    const idleButtons = Array.from(idle.querySelectorAll("button"));
    expect(idleButtons).toHaveLength(1);
    expect(idleButtons[0]?.getAttribute("aria-label")).toBe("Send message");

    const streaming = await mount(<Composer isStreaming onSubmit={vi.fn()} onStop={vi.fn()} />);
    const streamingButtons = Array.from(streaming.querySelectorAll("button"));
    expect(
      streamingButtons,
      "the Send/Stop morph was split into two elements — that is two tab stops across " +
        "one action slot (22-UI-SPEC Accessibility) and lets the accessible name drift " +
        "from the handler (T-61-09)",
    ).toHaveLength(1);
    expect(streamingButtons[0]?.getAttribute("aria-label")).toBe("Stop generating");
  });

  it("Leg 4 (T-61-08): the auto-grow clamp survives — the field is bounded and scrolls internally", async () => {
    const container = await mount(<Composer isStreaming={false} onSubmit={vi.fn()} onStop={vi.fn()} />);
    const field = container.querySelector("textarea");

    expect(field).not.toBeNull();
    // The rendered half of the guard: bounded height + internal overflow, so a
    // pasted novel scrolls inside the field instead of growing the dock past the
    // viewport and pushing the transcript off-screen.
    expect(field?.className).toContain("max-h-52");
    expect(field?.className).toContain("overflow-y-auto");

    // The scripted half: `resizeTextarea`'s Math.min clamp. Read from source
    // because the constant is module-private — exporting it purely to satisfy a
    // test would widen the component's API for the test's convenience
    // (source-walking mirrors inbox-structure.test.tsx Leg 4).
    const source = readFileSync(path.join(__dirname, "../composer.tsx"), "utf-8");
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).toContain("const MAX_TEXTAREA_HEIGHT_PX = 208");
    expect(
      codeOnly,
      "resizeTextarea no longer clamps to MAX_TEXTAREA_HEIGHT_PX — T-61-08's layout DoS is back",
    ).toContain("Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)");
  });

  it("Leg 5: no elevation on the dock — the identity's 'zero shadow anywhere' for this surface", async () => {
    const container = await mount(<Composer isStreaming={false} onSubmit={vi.fn()} onStop={vi.fn()} />);
    const dock = container.firstElementChild as HTMLElement | null;

    expect(dock).not.toBeNull();
    expect(
      dock?.className ?? "",
      "the composer dock carries an elevation shadow. The identity's own note is " +
        "'flat surfaces, hairline rules, zero shadow anywhere' — a hairline top rule IS " +
        "the separation between the composer and the transcript.",
    ).not.toMatch(/shadow-elevation/);

    // The rule that replaces it must actually be there — otherwise "no shadow"
    // is satisfied by a composer that floats with no separation at all.
    expect(dock?.className).toContain("border-t");
  });

  it("Leg 6: the rail's height chain is DECLARED at every link (e2a2abf's exact shape)", async () => {
    const container = await mount(<ConversationRail {...railProps(CONVERSATION_A)} />);

    // The rail body is located by its CONTENT (the New-chat control is its
    // first child), never by a height class — locating it by `h-full` and then
    // asserting `h-full` would be circular, and would silently start passing on
    // whatever element still happened to carry the class.
    //
    // The walk starts at the body rather than at a row on purpose: everything
    // BELOW the body is the ScrollArea's internals, which legitimately declare
    // no height — the viewport is the thing that scrolls. The chain under test
    // is body -> tree root.
    const newChat = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("New chat"),
    );
    expect(newChat, "could not find the rail's New-chat control").toBeDefined();
    const body = newChat!.parentElement;
    expect(body, "could not find the rail body").not.toBeNull();

    // WHAT THIS PROVES, EXACTLY: every element between the rail body and the
    // mounted tree root DECLARES a height. It does NOT prove any of them
    // RESOLVES — jsdom computes no layout, and `e2a2abf` was a resolution
    // failure. But that bug's mechanism was a DECLARATION going missing: Radix's
    // <Collapsible> renders a bare <div> with no class of its own, was given no
    // className, grew to content, and the document hit 11,296px. A missing link
    // here is exactly that. `npm run test:geometry` is what measures the rest.
    const chain: string[] = [];
    let node: HTMLElement | null = body as HTMLElement;
    while (node && node !== container) {
      chain.push(node.className || "(no class)");
      expect(
        node.className,
        `a link in the rail's height chain declares no height: "${node.className || "(no class)"}".\n` +
          `Chain from the rail body upward:\n  ${chain.join("\n  ")}\n\n` +
          `Every element from the rail body to the tree root must declare one, or the ` +
          `first one that does not grows to CONTENT and the document scrolls (e2a2abf: ` +
          `11,296px at a 900px viewport, through 363 green tests). If you restructured ` +
          `this subtree, run \`npm run test:geometry\` — this assertion cannot see layout.`,
      ).toMatch(/\bh-full\b/);
      node = node.parentElement;
    }

    // The walk must have actually walked — a `body` that is already the
    // container would vacuously pass the loop above.
    expect(chain.length, "the height-chain walk covered no elements").toBeGreaterThanOrEqual(3);
  });

  it("Leg 6b: the mobile Sheet renders the same rail body, and its rows carry the same selection contract", async () => {
    const container = await mount(<ConversationRail {...railProps(CONVERSATION_A)} mobileOpen />);

    // SheetContent portals to document.body (mirrors thread-cluster-indicator's
    // Radix-portal convention), so the desktop tree's container never sees it.
    const sheetRows = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="dialog"] [data-field="conversation-row"]'),
    );

    expect(sheetRows.length, "the mobile Sheet rendered no conversation rows").toBe(
      FAKE_CONVERSATIONS.length,
    );
    expect(sheetRows.filter((el) => el.getAttribute("data-active") === "true")).toHaveLength(1);

    void container;
  });
});
