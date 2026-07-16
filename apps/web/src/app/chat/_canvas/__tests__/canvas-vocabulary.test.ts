/**
 * canvas-vocabulary.test.ts — 61-02-PLAN.md Task 2 (tdd="true"): RED before
 * `canvas-vocabulary.ts` exists, GREEN after. Task 3 extends this file into
 * the full edge-tier x node-kind matrix gate.
 *
 * THE RETIRED NODE-TYPE FAMILY IS NEVER WRITTEN OUT IN THIS FILE. It is
 * assembled from parts, exactly as `role-hue-ban.test.ts` does. Phase 61 will
 * append `chat/` to that gate's `SCOPED_DIRS` ratchet as it sweeps (61-04/05),
 * at which point this file falls inside the walked scope — and a literal
 * colour-prefixed token here would make this gate execute itself.
 */

import { describe, expect, it } from "vitest";

import { TIER_HUE_FAMILY, TIER_IS_DASHED, type Tier } from "../../../_vocabulary/tier";
import {
  CANVAS_EDGE_TIER,
  CANVAS_NODE_KIND_GEOMETRY,
  CANVAS_NODE_KIND_LABEL,
  canvasNodeKindOf,
  type CanvasEdgeTier,
  type CanvasNodeKind,
} from "../canvas-vocabulary";
import { NODE_TYPE_REGISTRY } from "../node-type-registry";

const EDGE_TIERS: readonly CanvasEdgeTier[] = ["neutral", "confirmed", "suggested"];
const NODE_KINDS: readonly CanvasNodeKind[] = [
  "chat",
  "genui-panel",
  "email-thread",
  "knowledge-preview",
  "unknown",
];

/** See the header — assembled, never written out. */
const RETIRED_NODE_TYPE_FAMILY = ["gra", "ph"].join("") + "-";

/**
 * WHICH TIER EACH EDGE KIND CLAIMS. This is the only fact this test states on
 * its own, because it is the canvas's own semantic decision: a `neutral` edge
 * is a data wire — plumbing, not provenance — so it claims NO tier and (law 1:
 * colour is earned) earns no hue.
 *
 * What each claim LOOKS like is never restated here; it is derived from
 * TIER_HUE_FAMILY/TIER_IS_DASHED below. A test that hardcoded the appearance
 * would be a third map of the same fact.
 */
const EDGE_TIER_CLAIM: Record<CanvasEdgeTier, Tier | null> = {
  neutral: null,
  confirmed: "confirmed",
  suggested: "suggested",
};

/** The canvas draws SVG paths, so its idiom for "dashed" is a stroke-dasharray. */
const DASH_IDIOM = "dasharray";

function edgeStrings(tier: CanvasEdgeTier): string[] {
  const { path, joint } = CANVAS_EDGE_TIER[tier];
  return [path, joint];
}

describe("CANVAS_EDGE_TIER — tier owns colour and solid-vs-dashed, and nothing else does", () => {
  it("neutral makes NO tier claim, so it carries no hue and no dash (law 1: colour is earned)", () => {
    // The ONLY edge /chat renders today is a DataEdge wiring sourcePath ->
    // targetKey. That is plumbing, not provenance. It has no tier to state, so
    // it gets the sketch's `.e-neutral` and no colour whatsoever.
    for (const value of edgeStrings("neutral")) {
      expect(value).not.toContain("conf");
      expect(value).not.toContain("sugg");
      expect(value).not.toContain(DASH_IDIOM);
    }
  });

  for (const tier of EDGE_TIERS) {
    it(`${tier}: hue and dash follow the SHARED facts, not a second opinion`, () => {
      const claim = EDGE_TIER_CLAIM[tier];
      const family = claim === null ? null : TIER_HUE_FAMILY[claim];
      const isDashed = claim === null ? false : TIER_IS_DASHED[claim];
      const { path } = CANVAS_EDGE_TIER[tier];

      if (family === null) {
        expect(path, `${tier}.path must carry no tier hue`).not.toContain("conf");
        expect(path, `${tier}.path must carry no tier hue`).not.toContain("sugg");
      } else {
        expect(path, `${tier}.path must carry the ${family} family`).toContain(family);
      }

      expect(path.includes(DASH_IDIOM), `${tier}.path dashedness`).toBe(isDashed);
    });

    it(`${tier}: the joint dot matches its path's colour`, () => {
      const claim = EDGE_TIER_CLAIM[tier];
      const family = claim === null ? null : TIER_HUE_FAMILY[claim];
      const { joint } = CANVAS_EDGE_TIER[tier];

      if (family === null) {
        expect(joint).not.toContain("conf");
        expect(joint).not.toContain("sugg");
      } else {
        expect(joint, `${tier}.joint must carry the ${family} family`).toContain(family);
      }
    });
  }

  it("every edge tier is a fill/stroke lookup — no value carries a retired node-type token", () => {
    for (const tier of EDGE_TIERS) {
      for (const value of edgeStrings(tier)) {
        expect(value).not.toContain(RETIRED_NODE_TYPE_FAMILY);
      }
    }
  });
});

describe("canvasNodeKindOf — a persisted node.type is untrusted (T-61-06)", () => {
  it("resolves every registered node type to its own kind", () => {
    expect(canvasNodeKindOf("chat")).toBe("chat");
    expect(canvasNodeKindOf("genui-panel")).toBe("genui-panel");
    expect(canvasNodeKindOf("email-thread")).toBe("email-thread");
    expect(canvasNodeKindOf("knowledge-preview")).toBe("knowledge-preview");
  });

  it("resolves an UNRECOGNIZED type to \"unknown\" — never throws, never another kind's geometry", () => {
    // `node.type` arrives from chat_canvas_layouts, a user-writable row.
    // CANVAS-03's posture is degrade-gracefully: a legacy or hostile type
    // renders the placeholder, it does not crash the canvas.
    const hostile = [
      "",
      "not-a-node-type",
      "__proto__",
      "constructor",
      "toString",
      "chat ",
      "CHAT",
      "<script>alert(1)</script>",
    ];
    for (const type of hostile) {
      expect(canvasNodeKindOf(type), `canvasNodeKindOf(${JSON.stringify(type)})`).toBe("unknown");
    }
  });

  it("recognizes EXACTLY the node types the registry registers — one mapping, not two", () => {
    // If a fifth node type is registered and this vocabulary is not grown to
    // match, `canvasNodeKindOf` quietly answers "unknown" and the new node
    // renders as a degraded placeholder frame forever. That drift is a red
    // test here rather than a mystery on the canvas.
    const registered = Object.keys(NODE_TYPE_REGISTRY).sort();
    const known = NODE_KINDS.filter((kind) => kind !== "unknown").sort();
    expect(known).toEqual(registered);
  });
});

describe("CANVAS_NODE_KIND_GEOMETRY — kind is shape, never hue (law 3)", () => {
  /**
   * Bans a TIER or RETIRED-family token behind any colour-bearing prefix.
   * Chrome ink is deliberately allowed: `border-l-ink` is how the chat node's
   * left rule states "this is the conversation" without reaching for a hue.
   */
  const TIER_OR_RETIRED_HUE_PATTERN = new RegExp(
    `\\b(?:bg|text|border|border-[lrtxy]|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|divide)-(?:conf|sugg|${["gra", "ph"].join("")})`,
  );

  it("no kind's geometry names a tier or a retired node-type colour", () => {
    for (const kind of NODE_KINDS) {
      expect(CANVAS_NODE_KIND_GEOMETRY[kind], `${kind} geometry`).not.toMatch(
        TIER_OR_RETIRED_HUE_PATTERN,
      );
    }
  });

  it("no kind's geometry uses border-dashed — tier already owns solid-vs-dashed", () => {
    // The one collision on this surface, respected exactly as
    // region-vocabulary.ts respects it with `unrelated` (dotted, not dashed).
    for (const kind of NODE_KINDS) {
      expect(CANVAS_NODE_KIND_GEOMETRY[kind], `${kind} geometry`).not.toContain("dashed");
    }
  });

  it("all five kinds are structurally DISTINCT — kind is re-encoded, not deleted", () => {
    const values = NODE_KINDS.map((kind) => CANVAS_NODE_KIND_GEOMETRY[kind]);
    expect(new Set(values).size).toBe(NODE_KINDS.length);
  });
});

describe("CANVAS_NODE_KIND_LABEL — polytoken's word per kind, in ONE place", () => {
  it("names every kind with a non-empty word", () => {
    for (const kind of NODE_KINDS) {
      expect(CANVAS_NODE_KIND_LABEL[kind], `${kind} label`).toMatch(/\S/);
    }
  });

  it("all five labels are distinct", () => {
    const values = NODE_KINDS.map((kind) => CANVAS_NODE_KIND_LABEL[kind]);
    expect(new Set(values).size).toBe(NODE_KINDS.length);
  });
});

describe("no value ANYWHERE in the module carries the retired node-type family", () => {
  it("scans every exported map", () => {
    const everything = [
      ...EDGE_TIERS.flatMap(edgeStrings),
      ...NODE_KINDS.map((kind) => CANVAS_NODE_KIND_GEOMETRY[kind]),
      ...NODE_KINDS.map((kind) => CANVAS_NODE_KIND_LABEL[kind]),
    ];
    for (const value of everything) {
      expect(value).not.toContain(RETIRED_NODE_TYPE_FAMILY);
    }
  });
});
