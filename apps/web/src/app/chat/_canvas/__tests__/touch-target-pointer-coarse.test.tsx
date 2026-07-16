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
 * ────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE TRUSTING THE FIVE ASSERTIONS BELOW (61-08)
 * ────────────────────────────────────────────────────────────────────────
 *
 * The paragraph above is honest about its layer and WRONG about its
 * sufficiency, and it cost three milestones. **A class string being present
 * does not mean the class RENDERS.** Tailwind v4 only composes a variant onto
 * a utility whose NAME it knows. `touch-target` was hand-written into
 * `@layer utilities` — plain CSS, copied through, name never registered — so
 * `pointer-coarse:touch-target` matched nothing and emitted NOTHING, while
 * these assertions stayed green because the substring was right there in the
 * source. Measured in the running sheet (61-08): the app's only two
 * `@media (pointer: coarse)` blocks carried `height`/`width` from
 * `pointer-coarse:h-11`/`size-11`; there was no `min-height` rule at all. So
 * the `h-11` half of Phase 53's sweep applied and the `touch-target` half —
 * four call sites, including the panel toolbar's four icon buttons — never did.
 *
 * The fix is in `globals.css` (`@utility touch-target`, not `@layer utilities`)
 * and the LAST test here pins it, because that declaration is the only reason
 * any of the `touch-target` assertions above it mean anything. **A string gate
 * cannot see emission; pair it with the thing that makes the string real.**
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

  /**
   * THE ASSERTION THAT MAKES THE `touch-target` ONES ABOVE MEAN ANYTHING (61-08).
   *
   * Every `touch-target` consumer reaches the guard through a VARIANT
   * (`pointer-coarse:`), and Tailwind v4 can only compose a variant onto a
   * utility whose name it knows. Declared as `@layer utilities { .touch-target }`
   * the rule is plain CSS that Tailwind copies through without learning the
   * name — the bare class works, every variant of it silently emits nothing, and
   * the string assertions above stay green while no floor is applied to
   * anything. That was the live state until 61-08 measured the built sheet.
   *
   * `@utility` is what registers the name. This asserts the DECLARATION FORM,
   * which is the closest a source gate gets to "the rule renders" without a
   * browser — the real proof is a `@media (pointer: coarse)` block carrying
   * `min-height: 44px`, recorded in 61-08-SUMMARY.md.
   */
  it("globals.css declares touch-target with @utility, so pointer-coarse: actually composes onto it", () => {
    const globalsCss = readFileSync(path.resolve(CANVAS_DIR, "../../globals.css"), "utf-8");

    // Assembled from parts: this suite asserts on the utility BY NAME, and
    // `role-hue-ban`'s walk now covers `chat/` (61-08) — a literal here is one
    // paste away from being read as a live class by some future line-reading gate.
    const utilityName = ["touch", "target"].join("-");

    expect(
      new RegExp(`@utility\\s+${utilityName}\\s*\\{`).test(globalsCss),
      `globals.css must declare ${utilityName} with @utility — an @layer utilities ` +
        `rule is plain CSS Tailwind never learns the name of, so every ` +
        `pointer-coarse:${utilityName} in the app would emit nothing while this ` +
        `suite stayed green.`,
    ).toBe(true);

    // The floor itself — 44px (WCAG 2.5.8 / D-48-07), as a MIN, not a fixed size.
    const declaration = globalsCss.slice(globalsCss.indexOf(`@utility ${utilityName}`));
    expect(declaration).toMatch(/min-height:\s*44px/);
    expect(declaration).toMatch(/min-width:\s*44px/);
  });
});
