#!/usr/bin/env node
/**
 * rename-nauta-to-polytoken.mjs — Phase 42 Task 1 bulk rename.
 *
 * Zero-dependency, single-commit, reviewable rename of every MUST-rename
 * "nauta" surface (npm package scope, workspace name, UI chrome, docs,
 * Python identifiers, the "nauta-teal" style-pack id) to "polytoken",
 * while hard-excluding every KEEP surface (entity_instances.nauta_id/
 * nautaId/nauta_sync, live AWS/Terraform resource names, CI workflow env
 * vars, .planning/ historical docs, and the pre-existing dirty working-tree
 * files) by construction — never a case-insensitive blanket "nauta" replace.
 *
 * Placed under .planning/ deliberately: its own literal "@nauta/" data
 * strings below must not trip the Task 3 completeness grep, which excludes
 * .planning/ from its scan.
 *
 * Scope explicitly EXCLUDES .claude/skills/nauta-design-system/ — Task 2
 * owns that directory as its own isolated commit (its dirty SKILL.md edit
 * and untracked build-design-data.mjs must be preserved, not swept up here).
 *
 * Usage: node .planning/phases/42-atomic-rename-nauta-polytoken/rename-nauta-to-polytoken.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");

// ---------------------------------------------------------------------------
// Deny-list — directories/files never entered or matched by the broad scan.
// Mirrors 42-01-PLAN.md <keep_surfaces_deny_list> + operator hard exclusions.
// ---------------------------------------------------------------------------

/** Directory basenames skipped anywhere in the tree (build output / VCS). */
export const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".vercel",
  "graphify-out",
]);

/** Repo-relative (POSIX) path prefixes never entered. */
export const EXCLUDED_PATH_PREFIXES = [
  ".planning/", // historical docs + this phase's own deliverables
  "infrastructure/", // live AWS/Terraform resource names (RUNBOOK-only)
  ".github/", // CI workflow env vars name live AWS resources
  ".claude/skills/nauta-design-system/", // Task 2 owns this directory
  "apps/web/src/app/dev/design/", // pre-existing dirty/untracked scratch content
  "packages/db/migrations/", // KEEP — nauta_id/nauta_sync live schema history
];

/** Exact repo-relative (POSIX) file paths never touched. */
export const EXCLUDED_EXACT_FILES = new Set([
  // KEEP — live Postgres column (nautaId) + legacy-system prose comments.
  "packages/db/src/schema/entity-instances.ts",
  // Pre-existing dirty/untracked hard exclusions (not this phase's concern).
  "links.md",
  "COWORK-BRIEFING.md",
  "0 - nauta_design_case.pdf",
  "Nauta - Guia de Arquitetura (PT-BR).pdf",
  // Regenerated wholesale by Task 3's `npm install` — not hand-edited here.
  "package-lock.json",
]);

/** Extensions never scanned even if not otherwise excluded (binary). */
const BINARY_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

/** Extensions eligible for the broad scope-string scan (text sources). */
const SCANNABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".py",
  ".md",
  ".toml",
  ".yml",
  ".yaml",
  ".example",
]);

export const toPosix = (relPath) => relPath.split(path.sep).join("/");

export const isExcludedPath = (relPosixPath) =>
  EXCLUDED_EXACT_FILES.has(relPosixPath) ||
  EXCLUDED_PATH_PREFIXES.some((prefix) => relPosixPath.startsWith(prefix));

/**
 * Recursively walks `root`, returning repo-relative POSIX paths of every
 * file eligible for the broad scan (deny-list + extension filter applied).
 */
export const listCandidateFiles = (root) => {
  const results = [];
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, abs));
      if (isExcludedPath(rel)) continue;
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      if (BINARY_EXTENSIONS.has(ext)) continue;
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue;
      results.push(rel);
    }
  };
  walk(root);
  return results;
};

// ---------------------------------------------------------------------------
// Rule 1 — broad exact-substring scope substitutions.
// Safe to apply repo-wide (within the allow-scan) because these substrings
// never appear inside any KEEP surface (grep-verified in 42-RESEARCH.md and
// re-confirmed at plan-authoring time): npm scope prefix + the DECISION-1
// style-pack identifier (both casings found in the wild).
// ---------------------------------------------------------------------------

export const applyBroadScopeSubstitutions = (content) =>
  content
    .replaceAll("@nauta/", "@polytoken/")
    .replaceAll("nauta-teal", "polytoken-teal")
    .replaceAll("Nauta-teal", "Polytoken-teal");

// ---------------------------------------------------------------------------
// Rule 2 — site-specific substitutions (UI chrome, product-copy, docs).
// Each entry is a pure (content: string) => string keyed by exact
// repo-relative POSIX path — never a broad "Nauta" replace, since that
// prose word also appears in legitimate KEEP contexts elsewhere in the repo
// (e.g. packages/db/src/schema/sender-profiles.ts's "Nauta mirror" comment,
// packages/genui/src/eval/retrieval-golden-set.json's "Nauta Freight" test
// fixture, apps/email-listener/tests/application/test_cache_key.py's
// "vendor": "Nauta" fixture data) that must NOT be touched.
// ---------------------------------------------------------------------------

const replaceExact = (content, from, to) => {
  if (!content.includes(from)) return content;
  return content.split(from).join(to);
};

/** @type {Record<string, (content: string) => string>} */
export const SITE_SPECIFIC_TRANSFORMS = {
  "package.json": (c) =>
    replaceExact(c, '"name": "nauta-services"', '"name": "polytoken-services"'),

  "apps/web/src/app/layout.tsx": (c) =>
    replaceExact(c, 'title: "Nauta — Emails"', 'title: "Polytoken — Emails"'),

  "apps/web/src/app/emails/[id]/page.tsx": (c) =>
    replaceExact(c, 'title: "Loading… — Nauta"', 'title: "Loading… — Polytoken"'),

  "apps/web/src/app/entities/page.tsx": (c) =>
    replaceExact(c, 'title: "Entities — Nauta"', 'title: "Entities — Polytoken"'),

  "apps/web/src/app/entities/[id]/page.tsx": (c) =>
    replaceExact(c, 'title: "Entity — Nauta"', 'title: "Entity — Polytoken"'),

  "apps/web/src/app/knowledge/page.tsx": (c) =>
    replaceExact(c, 'title: "Knowledge — Nauta"', 'title: "Knowledge — Polytoken"'),

  "apps/web/src/app/studio/page.tsx": (c) => {
    const withTitle = replaceExact(c, 'title: "Studio — Nauta"', 'title: "Studio — Polytoken"');
    return replaceExact(
      withTitle,
      'description: "Component catalog, generation sandbox, and showcase — Nauta design system.",',
      'description: "Component catalog, generation sandbox, and showcase — Polytoken design system.",',
    );
  },

  "apps/web/src/app/studio/preview/page.tsx": (c) =>
    replaceExact(c, 'title: "Studio — Nauta"', 'title: "Studio — Polytoken"'),

  // Rendered brand text node + the "N" avatar-initial glyph next to it — both
  // must move together or the sidebar reads "P... Nauta"/"N... Polytoken"
  // (self-contradictory chrome), a Rule-1/Rule-2 completeness fix beyond the
  // plan's literal 1-site inventory count.
  "apps/web/src/components/app-sidebar.tsx": (c) => {
    const withInitial = c.replace(
      /(bg-primary text-xs font-semibold text-primary-foreground"\s*>\s*)N(\s*<\/span>)/,
      "$1P$2",
    );
    return replaceExact(withInitial, ">\n            Nauta\n          </span>", ">\n            Polytoken\n          </span>");
  },

  "apps/email-listener/app/settings.py": (c) =>
    replaceExact(
      c,
      'APP_NAME: str = "Nauta Email Listener"',
      'APP_NAME: str = "Polytoken Email Listener"',
    ),

  "apps/email-listener/pyproject.toml": (c) =>
    replaceExact(
      c,
      'description = "Nauta email listener — receives and logs raw inbound emails"',
      'description = "Polytoken email listener — receives and logs raw inbound emails"',
    ),

  // Whole-file scoped "Nauta" -> "Polytoken" — verified this file's ONLY
  // "Nauta" occurrences are product-copy exemplar strings (no KEEP surface
  // inside it); "nauta-teal" (lowercase) is handled separately by Rule 1.
  "apps/email-listener/app/infrastructure/llm/exemplars/__init__.py": (c) =>
    c.replaceAll("Nauta", "Polytoken"),

  "apps/email-listener/.env.example": (c) =>
    replaceExact(
      c,
      "# Nauta Email Listener — local development settings",
      "# Polytoken Email Listener — local development settings",
    ),

  "apps/email-listener/tests/corpus/README.md": (c) =>
    replaceExact(c, "# Nauta Test Corpus", "# Polytoken Test Corpus"),

  "apps/email-listener/README.md": (c) =>
    replaceExact(
      c,
      "those arrive in later stages of the Nauta data-entry pipeline.",
      "those arrive in later stages of the Polytoken data-entry pipeline.",
    ),

  "supabase/config.toml": (c) => replaceExact(c, 'project_id = "nauta"', 'project_id = "polytoken"'),

  // Comment labels only — the real project refs (fyfwkjvbcrmjqjysdyqw,
  // dazyccjijdahxyciptkp) are untouched; these are the ONLY "nauta"
  // occurrences in this file (verified via case-insensitive scan).
  ".env.example": (c) => c.replaceAll("nauta-staging", "polytoken-staging").replaceAll("nauta-prod", "polytoken-prod"),

  // Prose only (lines 1 + 3) — the deploy-target table cells at lines 56-57
  // (`nauta-services-email-listener`) are a DIFFERENT exact string, RUNBOOK-
  // only, and are never matched by either replacement below.
  "README.md": (c) => {
    const withHeading = replaceExact(c, "# nauta.services", "# polytoken.services");
    return replaceExact(
      withHeading,
      'Monorepo for Nauta services. First service: **email-listener** — a FastAPI server that receives and logs raw inbound emails, the entry point for the Nauta "Data-Entry Brain" pipeline.',
      'Monorepo for Polytoken services. First service: **email-listener** — a FastAPI server that receives and logs raw inbound emails, the entry point for the Polytoken "Data-Entry Brain" pipeline.',
    );
  },

  // Demo showcase metadata + its own doc comment — this genui demo spec's
  // `author`/`Author` fields literally carry the product name as example
  // byline data (not legacy-system or test-fixture data), so it moves with
  // the rename per the "no lingering brand-named identifiers" guardrail.
  "packages/genui/src/demo/showcase-spec.ts": (c) => {
    const withComment = replaceExact(c, "NOT Nauta-flavored (D-17)", "NOT Polytoken-flavored (D-17)");
    const withAuthorField = replaceExact(withComment, 'author: "Nauta",', 'author: "Polytoken",');
    return replaceExact(withAuthorField, '{ key: "Author", value: "Nauta" },', '{ key: "Author", value: "Polytoken" },');
  },
};

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Applies both rule sets to one file's content. Pure — returns the new
 * content string, never mutates the input.
 */
export const transformFileContent = (relPosixPath, content) => {
  const afterBroad = applyBroadScopeSubstitutions(content);
  const siteTransform = SITE_SPECIFIC_TRANSFORMS[relPosixPath];
  return siteTransform ? siteTransform(afterBroad) : afterBroad;
};

export const runRename = ({ dryRun = false } = {}) => {
  const candidates = listCandidateFiles(REPO_ROOT);
  // Site-specific-only targets may fall outside the extension/dir scan in
  // rare cases (none currently do — every SITE_SPECIFIC_TRANSFORMS key is
  // already inside the scannable set), but union them defensively so a
  // future addition can't silently no-op.
  const allTargets = new Set([...candidates, ...Object.keys(SITE_SPECIFIC_TRANSFORMS)]);

  const changed = [];
  for (const relPosixPath of allTargets) {
    if (isExcludedPath(relPosixPath)) continue; // defensive: site list must respect deny-list too
    const absPath = path.join(REPO_ROOT, ...relPosixPath.split("/"));
    let original;
    try {
      original = readFileSync(absPath, "utf8");
    } catch {
      continue; // file doesn't exist under this root (shouldn't happen) — skip
    }
    const updated = transformFileContent(relPosixPath, original);
    if (updated === original) continue;
    changed.push(relPosixPath);
    if (!dryRun) writeFileSync(absPath, updated, "utf8");
  }
  return changed;
};

const isMainModule = () => {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return invoked === path.resolve(fileURLToPath(import.meta.url));
};

if (isMainModule()) {
  const dryRun = process.argv.includes("--dry-run");
  const changed = runRename({ dryRun });
  console.log(`${dryRun ? "[dry-run] " : ""}${changed.length} file(s) changed:`);
  for (const f of changed.sort()) console.log(`  ${f}`);
}
