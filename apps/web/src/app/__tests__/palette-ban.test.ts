import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Committed D-49-05 regression gate (51-07-PLAN.md Task 1): makes RSKN-05's
 * token discipline ENFORCEABLE, not aspirational.
 *
 * Mirrors token-registration.test.ts's grep idiom: walks every `.ts`/`.tsx`
 * file under `apps/web/src` and bans classic Tailwind palette color classes
 * (the pre-token-system neutral/hue families) on any color-bearing utility
 * prefix with a numeric scale, plus literal `-white`/`-black`.
 *
 * EXCLUDED (token sources + user-owned scratch, never walked):
 *   - `app/globals.css`      -- the token source file itself (also excluded
 *                               structurally: this gate only walks .ts/.tsx)
 *   - `../tailwind.config.ts` -- the Tailwind config (also excluded
 *                               structurally: lives outside apps/web/src)
 *   - `app/dev/**`           -- 999.14 user-owned scratch + showcase pages,
 *                               explicitly out of the re-skin's surface area
 *
 * An explicit inline ALLOWLIST lets genuinely-justified occurrences pass
 * (e.g. a token-source-internal literal). It starts EMPTY -- Wave 1 of
 * Phase 51 converted every production surface; see 51-01..51-06-SUMMARY.md.
 * Do not add to it without a documented reason.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** apps/web/src -- the root this gate walks. */
const APP_SRC = path.resolve(__dirname, "..", "..");

/** Directories under APP_SRC that are structurally excluded from the walk. */
const EXCLUDED_DIR_SEGMENTS = new Set(["dev", "node_modules", ".next"]);

const FILE_EXTENSIONS = new Set([".ts", ".tsx"]);

const PALETTE_FAMILIES = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

const COLOR_UTILITY_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "from",
  "via",
  "to",
  "fill",
  "stroke",
  "decoration",
  "outline",
  "divide",
  "placeholder",
  "caret",
  "accent",
  "shadow",
] as const;

// Matches prefix+family+numeric-scale color utilities -- e.g. a filled
// violet swatch at weight 500, an emerald text weight of 800, or a blue
// ring weight of 200. (Deliberately not written as a literal example
// string in this comment: this gate walks its own source file too, and a
// literal match here would be a false positive against itself.)
const SCALED_PALETTE_PATTERN = new RegExp(
  `\\b(?:${COLOR_UTILITY_PREFIXES.join("|")})-(?:${PALETTE_FAMILIES.join("|")})-[0-9]{2,3}\\b`,
  "g",
);

// Matches literal white/black fills with no numeric scale (background,
// text, border, fill, or stroke utilities pinned to pure white or black).
const LITERAL_WHITE_BLACK_PATTERN = /\b(?:bg|text|border|fill|stroke)-(?:white|black)\b/g;

type Violation = {
  readonly file: string;
  readonly line: number;
  readonly match: string;
};

/**
 * Inline allowlist for genuinely-justified occurrences (starts EMPTY).
 * Shape: `{ file, pattern, reason }` -- `file` is APP_SRC-relative (POSIX
 * separators), `pattern` is matched via `String.includes` against the
 * violating line's matched text.
 */
const ALLOWLIST: ReadonlyArray<{ file: string; pattern: string; reason: string }> = [];

function isAllowlisted(file: string, matchedText: string): boolean {
  return ALLOWLIST.some((entry) => entry.file === file && matchedText.includes(entry.pattern));
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (EXCLUDED_DIR_SEGMENTS.has(entry)) {
        return [];
      }
      return collectSourceFiles(fullPath);
    }
    const ext = path.extname(entry);
    return FILE_EXTENSIONS.has(ext) ? [fullPath] : [];
  });
}

function findViolationsInFile(absPath: string): Violation[] {
  const relPath = path.relative(APP_SRC, absPath).split(path.sep).join("/");
  const content = readFileSync(absPath, "utf-8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  lines.forEach((lineText, index) => {
    const lineNumber = index + 1;
    for (const pattern of [SCALED_PALETTE_PATTERN, LITERAL_WHITE_BLACK_PATTERN]) {
      const matches = lineText.match(pattern);
      if (!matches) continue;
      for (const match of matches) {
        if (isAllowlisted(relPath, match)) continue;
        violations.push({ file: relPath, line: lineNumber, match });
      }
    }
  });

  return violations;
}

function findAllViolations(): Violation[] {
  const files = collectSourceFiles(APP_SRC);
  return files.flatMap(findViolationsInFile);
}

describe("palette-class regression gate (RSKN-05 enforceability, D-49-05)", () => {
  it("excludes app/dev/** scratch from the walk", () => {
    // Structural assertion that the exclusion mechanism this gate relies on
    // is actually configured, independent of whether any violation exists
    // there today.
    expect(Array.from(EXCLUDED_DIR_SEGMENTS)).toContain("dev");
  });

  it("bans classic Tailwind palette classes across apps/web/src, excluding globals.css/tailwind-config/dev scratch", () => {
    const violations = findAllViolations();

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line} -> "${v.match}"`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} classic Tailwind palette class violation(s) outside the ` +
          `token system (excluded: globals.css, tailwind.config.ts, app/dev/**):\n${report}\n\n` +
          `Convert to the app's design-token aliases per the D-49-03 conversion map, or add a ` +
          `justified entry to ALLOWLIST in this file with a documented reason.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
