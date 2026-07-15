import { describe, it } from "vitest";

/**
 * Regression guard for the "CSS var exists but Tailwind utility was never
 * registered" bug class (28-VERIFICATION gap, closed in 69c3afa): the
 * `--sidebar-*` vars were correctly aliased to teal tokens in globals.css,
 * yet `bg-sidebar`/`ring-sidebar-ring` emitted no CSS because no `sidebar`
 * color family existed in the config that actually compiles apps/web — so
 * the app silently kept Tailwind's stock blue ring. This test asserts every
 * token FAMILY that globals.css declares vars for is registered in the
 * resolved Tailwind theme, independent of whether a consumer exists yet.
 *
 * SKIPPED for Tailwind v4 Stage 1 (55-01-PLAN.md): `tailwindcss/resolveConfig`
 * does not exist in tailwindcss@4.x — confirmed live during 55-01 execution
 * (`npm run test -w @polytoken/web` threw Vite's
 * `Missing "./resolveConfig" specifier in "tailwindcss" package`, and
 * `npm run typecheck -w @polytoken/web` failed the same way because TS's
 * classic module resolution fell through to the ROOT-hoisted
 * tailwindcss@3.4.x copy — see 55-01-SUMMARY.md for the full trace). This
 * confirms 55-RESEARCH.md's Pitfall 5 exactly as written ("fails at the
 * import line regardless of whether tailwind.config.ts itself still exists
 * via @config") — 55-01-PLAN.md's Task 1 acceptance criteria assumed this
 * gate would still pass through Stage 1, but the resolveConfig()-removal
 * breakage is triggered by the tailwindcss devDependency bump itself, not
 * by any CSS value change, so it cannot be deferred to Stage 2.
 *
 * Rewritten for real in Stage 3 (55-03) per 55-RESEARCH.md's stage map:
 * parse the `@theme inline` block of globals.css directly (reusing
 * token-contrast.test.ts's readTokenBlock-style helper) instead of
 * resolveConfig(). The `resolveConfig`/`appConfig` imports are removed
 * here (not just skipped) because the import itself is what throws — a
 * `describe.skip` alone does not prevent ESM import evaluation. Test names
 * below are preserved as the Stage-3 rewrite target; do not re-enable
 * before that rewrite lands.
 */
describe.skip("token family registration (guards the unregistered-utility bug class) — PENDING 55-03 rewrite: tailwindcss/resolveConfig() does not exist in v4", () => {
  it("registers the full sidebar family against the --sidebar-* vars", () => {});

  it("registers chart-1..5 against the --chart-* vars", () => {});

  it("registers the elevation shadow scale", () => {});

  it("registers the xl/2xl radius steps", () => {});
});
