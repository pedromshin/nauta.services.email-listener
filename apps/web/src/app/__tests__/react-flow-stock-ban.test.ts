import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Committed stock-React-Flow ban (61-05-PLAN.md Task 3). Makes ROADMAP
 * criterion 2 -- "zero stock React Flow default styling remaining" -- a fact
 * instead of a sentence in a summary. It is the only criterion in Phase 61
 * phrased as an absolute, which means it is either checkable or it is a wish.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY IT PARSES THE LIBRARY'S OWN STYLESHEET INSTEAD OF LISTING SELECTORS
 * ────────────────────────────────────────────────────────────────────────
 *
 * A hand-written "we overrode these five" test passes forever and tells you
 * nothing on the day xyflow ships a sixth. `@xyflow/react/dist/style.css` is
 * imported WHOLESALE into the global cascade on two surfaces (/chat's canvas
 * and /knowledge's graph), so any upgrade can introduce new default chrome on
 * both at once, silently (T-61-14).
 *
 * So this gate reads the SHIPPED stylesheet out of the real dependency, via
 * `require.resolve` against the package's own export map -- never a vendored
 * copy, never a hardcoded path into a version directory. A version bump that
 * adds default chrome turns this RED instead of turning up on a user's screen.
 * That is the entire justification for the extra machinery.
 *
 * ────────────────────────────────────────────────────────────────────────
 * VISIBLE vs MECHANICS -- the distinction this gate lives or dies on
 * ────────────────────────────────────────────────────────────────────────
 *
 * React Flow's stylesheet is mostly MECHANICS: `position`, `transform`,
 * `pointer-events`, `z-index`, `width`/`height`, `user-select`, `cursor`.
 * Overriding those would break the canvas outright -- they are how a node
 * lands where it was dragged, not how it looks. Only `VISIBLE_PROPERTIES`
 * below is "styling" for criterion 2's purposes. That constant is exported so
 * the judgement is readable rather than reverse-engineered out of a regex.
 *
 * `border-radius` is deliberately NOT in it: it is geometry, not colour. The
 * app themes it anyway (see globals.css), but a gate that demanded it would be
 * asserting taste, not criterion 2.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHAT COUNTS AS AN OVERRIDE -- and why a plain CSS rule DOES NOT
 * ────────────────────────────────────────────────────────────────────────
 *
 * This is the load-bearing part, and it is counter-intuitive enough that it
 * shipped a real bug for two milestones (61-05-SUMMARY.md).
 *
 * The library's stylesheet is imported from a client component, so Next emits
 * it UNLAYERED. Everything in globals.css is inside a Tailwind v4 cascade
 * layer. In the CSS cascade, layer precedence is resolved BEFORE specificity,
 * and unlayered normal declarations WIN over layered ones -- always. So a
 * layered `.react-flow__minimap { background: ... }` in globals.css does not
 * override the library's `background` on that same selector. It loses, and it
 * loses silently. Phase 26 wrote exactly that, and the minimap rendered pure
 * white on a dark canvas for two milestones while the rule sat in the file
 * looking correct.
 *
 * A stock declaration is therefore only genuinely unreachable when:
 *
 *   1. it PAINTS NOTHING -- the stock value is `none`/`transparent`, so there
 *      is no stock chrome to remove in the first place; or
 *   2. it is VARIABLE-THEMED -- the stock value resolves through
 *      `var(--xy-NAME, var(--xy-NAME-default))` and globals.css sets at least
 *      one non-default var in that chain. Setting ANY link makes the `-default`
 *      tail unreachable, because the tail is only consulted when every earlier
 *      link is unset. This is the library's own supported theming API and it
 *      sidesteps the cascade entirely: we set `--xy-NAME`, the library declares
 *      only `--xy-NAME-default`, and two different property names never fight; or
 *   3. it is FORCED -- globals.css declares the same property on the same
 *      selector with `!important`, which is the only thing that beats an
 *      unlayered normal declaration from inside a layer.
 *
 * Requiring (3) rather than accepting any same-selector rule is the whole point:
 * it makes the gate reject exactly the dead override that fooled everyone.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THE BLIND SPOT, STATED RATHER THAN DISCOVERED LATER
 * ────────────────────────────────────────────────────────────────────────
 *
 * This gate reads STYLESHEETS. It cannot see a colour the library hardcodes in
 * JAVASCRIPT and applies as an inline style, because no stylesheet mentions it.
 * There is exactly one such case today and 61-05 found it by looking at the
 * canvas, not by running this: React Flow paints the edge ARROWHEAD from a JS
 * constant, so the wire rendered ink while its own arrowhead rendered the
 * library's blue-grey. This gate reported nothing, correctly and uselessly --
 * `.react-flow__arrowhead polyline` IS var-themed in the stylesheet, and the
 * inline style silently outranks it. It is fixed at the call site
 * (`chat-canvas.tsx`'s marker config).
 *
 * DO NOT read a green run here as "the canvas has no stock chrome". Read it as
 * "no stock value in the library's STYLESHEET can reach the screen". Those are
 * different claims, and the gap between them is exactly one class of defect
 * wide. Look at the surface too.
 *
 * ────────────────────────────────────────────────────────────────────────
 * ON WRITING LITERALS IN THIS FILE
 * ────────────────────────────────────────────────────────────────────────
 *
 * `role-hue-ban.test.ts` warns that a gate reading LINES cannot tell a comment
 * from a class, so a literal example in a scanned file matches itself. This
 * file's honest position is narrower: it reads `globals.css` and a stylesheet
 * in `node_modules`, and walks no app source, so it does not execute itself.
 * That immunity is an accident of WHERE THIS FILE HAPPENS TO SIT, not a
 * property of its design -- every selector it matches on is read out of the
 * parsed stylesheet rather than written here, and it should stay that way.
 *
 * Comments ARE stripped before parsing, unlike the token gates (which parse
 * comment-UNAWARE by design, §F). The difference is deliberate: those gates
 * guard a hazard that lives in comment prose, whereas a commented-out rule here
 * is not an override and must not be counted as one.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** apps/web/src/app/globals.css -- the override block this gate checks against. */
const GLOBALS_CSS_PATH = path.resolve(__dirname, "..", "globals.css");

const requireFrom = createRequire(import.meta.url);

/**
 * The SHIPPED stylesheet, resolved through the real dependency's own export map
 * (`@xyflow/react`'s package.json exports `./dist/style.css` explicitly). Never
 * a vendored copy and never a hardcoded version directory: if an upgrade moves
 * or renames this file, resolution throws and the vacuity guard below reports
 * it, rather than this gate quietly parsing nothing.
 */
function resolveShippedStylesheet(): string {
  try {
    return requireFrom.resolve("@xyflow/react/dist/style.css");
  } catch {
    // An upgrade that drops `./dist/style.css` from the package's export map
    // lands here. Return the path it WOULD have had so the vacuity guard can
    // report it by name instead of this module throwing during import.
    return path.resolve(__dirname, "..", "..", "..", "..", "..", "node_modules", "@xyflow", "react", "dist", "style.css");
  }
}

/**
 * Reads the stylesheet DEFENSIVELY rather than letting `readFileSync` throw at
 * module scope. That distinction is the difference between a guard and a stack
 * trace: if this module throws during import, vitest reports "no tests" and an
 * ENOENT, and the reader has to reverse-engineer what broke. Returning empty
 * lets the vacuity guards below fail with the sentence that actually explains
 * it — "the resolved xyflow stylesheet does not exist at <path>" — which is the
 * whole point of having them.
 */
function readIfPresent(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
}

/**
 * The properties that PAINT. Everything else in React Flow's stylesheet is
 * mechanics (see the header): overriding `position`/`transform`/`pointer-events`
 * would break the canvas, not restyle it.
 *
 * Exported so this judgement is reviewable as a list rather than inferred from a
 * regex. Additions are cheap; removals are a scope reduction and need a reason.
 */
export const VISIBLE_PROPERTIES: readonly string[] = [
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "color",
  "fill",
  "stroke",
  "box-shadow",
  "outline",
];

const VISIBLE_PROPERTY_SET = new Set(VISIBLE_PROPERTIES);

/**
 * Inline allowlist for genuinely-justified stock declarations, mirroring
 * `palette-ban.test.ts`'s posture. It is EMPTY, and that is the finding rather
 * than an accident: xyflow v12 routes essentially every visible value through a
 * `--xy-*` variable, so the library's own theming API covers the surface and
 * nothing needed excusing.
 *
 * DO NOT ADD TO IT WITHOUT A DOCUMENTED REASON. An entry that says "hard" or
 * "this component never mounts" is a scope reduction wearing a comment: the
 * resize controls and the built-in node types are mounted by no surface today
 * and are themed anyway, because two lines of CSS beat a note that rots the
 * first time someone adds a `<NodeResizer>`. If a stock value genuinely must
 * survive, take it to the identity record, not to this array.
 */
const ALLOWLIST: ReadonlyArray<{
  readonly selector: string;
  readonly property: string;
  readonly reason: string;
}> = [];

interface Declaration {
  readonly property: string;
  readonly value: string;
}

interface Rule {
  readonly selector: string;
  readonly declarations: readonly Declaration[];
}

interface Violation {
  readonly selector: string;
  readonly property: string;
  readonly stockValue: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Parses FLAT rules (`selector { decls }`) out of a stylesheet.
 *
 * `@keyframes` blocks are removed first: they nest, and the flat matcher would
 * otherwise read their inner steps as rules. Everything else in both files is
 * flat -- and crucially, the `([^{}]+)\{([^{}]*)\}` shape simply SKIPS a
 * wrapper whose body contains braces, so globals.css's `@layer components { ... }`
 * yields its inner rules rather than one unusable blob.
 */
function parseFlatRules(css: string): Rule[] {
  const withoutComments = stripComments(css);
  const withoutKeyframes = withoutComments.replace(
    /@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
    "",
  );

  const rules: Rule[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let ruleMatch: RegExpExecArray | null = rulePattern.exec(withoutKeyframes);
  while (ruleMatch !== null) {
    const selector = (ruleMatch[1] ?? "").trim().replace(/\s+/g, " ");
    const body = ruleMatch[2] ?? "";
    const declarations: Declaration[] = [];
    const declPattern = /([-\w]+)\s*:\s*([^;]+);/g;
    let declMatch: RegExpExecArray | null = declPattern.exec(body);
    while (declMatch !== null) {
      declarations.push({
        property: (declMatch[1] ?? "").trim(),
        value: (declMatch[2] ?? "").trim().replace(/\s+/g, " "),
      });
      declMatch = declPattern.exec(body);
    }
    if (selector.length > 0) {
      rules.push({ selector, declarations });
    }
    ruleMatch = rulePattern.exec(withoutKeyframes);
  }
  return rules;
}

/** `a, b` -> [`a`, `b`], normalized. A stock rule often targets a selector LIST. */
function splitSelectorList(selector: string): string[] {
  return selector
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part.length > 0);
}

/**
 * The stock value paints nothing, so there is no stock chrome to remove.
 *
 * `outline: none` is the interesting member: it does have a visible EFFECT (it
 * removes the browser's focus ring), but it paints no React Flow branding, which
 * is what criterion 2 is about. That is an accessibility question, not a stock-
 * styling one -- and it is answered in globals.css, which puts an ink
 * focus-visible outline back on nodes rather than leaving keyboard focus
 * invisible.
 */
function paintsNothing(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s*!important$/, "");
  return normalized === "none" || normalized === "transparent";
}

/** Every `--xy-*` name a value reads, excluding the `-default` tail. */
function themableVarsIn(value: string): string[] {
  return [...value.matchAll(/--xy-[\w-]+/g)]
    .map((match) => match[0])
    .filter((name) => !name.endsWith("-default"));
}

function hasImportant(value: string): boolean {
  return /!important\s*$/.test(value.trim());
}

// ---------------------------------------------------------------------------
// Parse both sides once.
// ---------------------------------------------------------------------------

const stylesheetPath = resolveShippedStylesheet();
const stockRules = parseFlatRules(readIfPresent(stylesheetPath));
const globalsRules = parseFlatRules(readIfPresent(GLOBALS_CSS_PATH));

/** The `--xy-*` theming variables globals.css SETS (its declarations, not its prose). */
const themedVars = new Set<string>();
for (const rule of globalsRules) {
  for (const declaration of rule.declarations) {
    if (declaration.property.startsWith("--xy-")) {
      themedVars.add(declaration.property);
    }
  }
}

/** selector -> the properties globals.css forces on it with `!important`. */
const forcedOverrides = new Map<string, Set<string>>();
for (const rule of globalsRules) {
  for (const declaration of rule.declarations) {
    if (!hasImportant(declaration.value)) continue;
    for (const selector of splitSelectorList(rule.selector)) {
      const existing = forcedOverrides.get(selector) ?? new Set<string>();
      existing.add(declaration.property);
      forcedOverrides.set(selector, existing);
    }
  }
}

function isAllowlisted(selector: string, property: string): boolean {
  return ALLOWLIST.some((entry) => entry.selector === selector && entry.property === property);
}

/** The three ways a stock declaration becomes unreachable (see the header). */
function isNeutralized(selector: string, declaration: Declaration): boolean {
  if (paintsNothing(declaration.value)) return true;
  if (themableVarsIn(declaration.value).some((name) => themedVars.has(name))) return true;
  return forcedOverrides.get(selector)?.has(declaration.property) === true;
}

function collectViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const rule of stockRules) {
    for (const declaration of rule.declarations) {
      if (!VISIBLE_PROPERTY_SET.has(declaration.property)) continue;
      for (const selector of splitSelectorList(rule.selector)) {
        if (isNeutralized(selector, declaration)) continue;
        if (isAllowlisted(selector, declaration.property)) continue;
        violations.push({
          selector,
          property: declaration.property,
          stockValue: declaration.value,
        });
      }
    }
  }
  return violations;
}

/**
 * Reports selectors, the visible properties they set, and the STOCK VALUES --
 * mirrors `palette-ban.test.ts`'s report() shape. A gate whose red output does
 * not tell you what the user is looking at gets re-run instead of read.
 */
function report(violations: readonly Violation[]): string {
  const lines = violations.map(
    (violation) =>
      `  ${violation.selector}\n      ${violation.property}: ${violation.stockValue}`,
  );
  return (
    `${violations.length} stock React Flow declaration(s) can still reach the screen ` +
    `(ROADMAP criterion 2: "zero stock React Flow default styling remaining").\n\n` +
    `Parsed from the SHIPPED stylesheet at:\n  ${stylesheetPath}\n\n` +
    `${lines.join("\n")}\n\n` +
    `FIX, in order of preference:\n` +
    `  1. If the stock value reads a \`--xy-*\` variable, set that variable on\n` +
    `     \`.react-flow\` in globals.css. That is the library's own theming API and\n` +
    `     it never fights the cascade.\n` +
    `  2. Only if the stock value is a hardcoded literal, override the property on\n` +
    `     the same selector in globals.css WITH \`!important\`. Without the important\n` +
    `     flag the rule LOSES: the library's stylesheet is unlayered and globals.css\n` +
    `     is layered, and unlayered beats layered regardless of specificity. A rule\n` +
    `     that looks correct and does nothing is how the minimap shipped pure white\n` +
    `     on a dark canvas for two milestones.\n\n` +
    `If this went red after a dependency bump, xyflow shipped new default chrome —\n` +
    `which is exactly what this gate exists to tell you. Do not allowlist it.`
  );
}

describe("stock React Flow ban (ROADMAP criterion 2, 61-05)", () => {
  // ── VACUITY GUARDS ──
  // A gate that inspects nothing passes everything, which is precisely how a
  // green suite ends up certifying a surface no one has looked at. These run
  // first and fail loudly rather than letting the real assertion pass on an
  // empty set (stolen from role-hue-ban.test.ts's "every scoped root actually
  // yields files").
  it("resolves the SHIPPED stylesheet from the real dependency", () => {
    expect(
      existsSync(stylesheetPath),
      `the resolved xyflow stylesheet does not exist at ${stylesheetPath}. An ` +
        "upgrade that moves or renames dist/style.css would otherwise leave this " +
        "gate parsing nothing and passing everything.",
    ).toBe(true);
    // Resolved through the dependency's export map, so it must live in node_modules
    // rather than being a copy someone vendored into the repo.
    expect(
      stylesheetPath.replace(/\\/g, "/"),
      "the stylesheet must resolve inside node_modules — a vendored copy would " +
        "freeze this gate at whatever version was copied, which is the entire " +
        "failure mode it exists to prevent (T-61-14).",
    ).toContain("node_modules/@xyflow/react/");
  });

  it("parses a non-zero number of selectors and visible declarations", () => {
    expect(
      stockRules.length,
      "parsed zero rules out of the xyflow stylesheet — the parser or the file " +
        "shape changed, and this gate is now inspecting nothing.",
    ).toBeGreaterThan(50);

    const visibleCount = stockRules.filter((rule) =>
      rule.declarations.some((declaration) => VISIBLE_PROPERTY_SET.has(declaration.property)),
    ).length;
    expect(
      visibleCount,
      "parsed zero rules that set a VISIBLE property. Either VISIBLE_PROPERTIES " +
        "no longer matches the stylesheet's vocabulary, or the parse is broken. " +
        "Both make every assertion below vacuous.",
    ).toBeGreaterThan(20);
  });

  it("finds the override block in globals.css", () => {
    expect(
      themedVars.size,
      "globals.css sets no `--xy-*` theming variables at all, so the React Flow " +
        "override block is missing or was renamed. Every stock declaration would " +
        "be reported as a violation, or (worse) a future refactor of this gate " +
        "could make them all pass.",
    ).toBeGreaterThan(15);
  });

  // ── THE ASSERTION ──
  it("leaves no stock visible-property declaration able to reach the screen", () => {
    const violations = collectViolations();
    expect(violations, violations.length === 0 ? "" : report(violations)).toEqual([]);
  });

  it("keeps the allowlist empty, or at least reasoned", () => {
    for (const entry of ALLOWLIST) {
      expect(
        entry.reason.length,
        `ALLOWLIST entry for "${entry.selector}" carries no reason. Every entry " +
          "must say why a stock value is allowed to survive.`,
      ).toBeGreaterThan(20);
    }
  });
});
