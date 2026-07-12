/**
 * touch-target-pointer-coarse.test.tsx — 53-02-PLAN.md Task 2's committed
 * class-string test locking in the `pointer-coarse:` hit-area sweep across
 * all six 53-UI-SPEC-listed canvas controls (Spacing Scale table + Judgment
 * Call #1).
 *
 * Pure class-string assertion suite — deliberately NO jsdom `matchMedia`
 * mock. `(pointer: coarse)` is a CSS media FEATURE, not a viewport-width
 * media query; jsdom's `matchMedia` stub (and every mock convention already
 * used elsewhere in this repo, e.g. `useIsMobileViewport`'s `(max-width:
 * 767px)` mock) targets width queries only, and cannot meaningfully
 * exercise a pointer-capability feature. Asserting the CLASS STRING is
 * present is therefore the correct, and only testable, contract at this
 * layer (53-UI-SPEC.md Verification Gates, verbatim).
 *
 * `PANEL_ACTION_ICON_BUTTON_CLASS` is an exported constant — imported and
 * asserted directly (covers all 4 toolbar icon buttons via the one shared
 * recipe). The toolbar row, `PackSwitcher`'s `TRIGGER_CLASS`, and
 * `KnowledgePreviewNode`'s remove button / footer link are inline
 * `className` literals with no exported constant — asserted by reading each
 * component's own source file text and checking for the required
 * substrings (mirrors `palette-ban.test.ts`'s `readFileSync` + `import.meta.url`
 * idiom already established in this repo for source-text assertions).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PANEL_ACTION_ICON_BUTTON_CLASS } from "../controls/panel-action-button-class";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** apps/web/src/app/chat/_canvas -- the directory this suite's source files live in. */
const CANVAS_DIR = path.resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(CANVAS_DIR, relativePath), "utf-8");
}

describe("touch-target pointer-coarse: sweep (53-UI-SPEC Spacing Scale table)", () => {
  it("PANEL_ACTION_ICON_BUTTON_CLASS carries pointer-coarse:touch-target (all 4 toolbar icon buttons)", () => {
    expect(PANEL_ACTION_ICON_BUTTON_CLASS).toContain("pointer-coarse:touch-target");
    // Hit-area only -- the base size-6 recipe stays, no visual redesign.
    expect(PANEL_ACTION_ICON_BUTTON_CLASS).toContain("size-6");
  });

  it("PanelActionsToolbar's role=toolbar row carries pointer-coarse:h-11 (base h-8 retained)", () => {
    const source = readSource("panel-actions-toolbar.tsx");
    expect(source).toContain("pointer-coarse:h-11");
    expect(source).toContain("h-8");
  });

  it("PackSwitcher's TRIGGER_CLASS carries pointer-coarse:h-11 (base h-6 w-28 retained)", () => {
    const source = readSource("controls/pack-switcher.tsx");
    expect(source).toMatch(/TRIGGER_CLASS =\s*\n?\s*"[^"]*pointer-coarse:h-11[^"]*"/);
    expect(source).toContain("h-6 w-28");
  });

  it("KnowledgePreviewNode's remove button carries pointer-coarse:touch-target (glyph stays size-3.5)", () => {
    const source = readSource("knowledge-preview-node.tsx");
    expect(source).toMatch(/size-6 shrink-0[^"]*pointer-coarse:touch-target/);
    expect(source).toContain("size-3.5");
  });

  it("KnowledgePreviewNode's footer link carries pointer-coarse:h-11 (base h-7 retained)", () => {
    const source = readSource("knowledge-preview-node.tsx");
    expect(source).toMatch(/h-7 w-full[^"]*pointer-coarse:h-11/);
  });
});
