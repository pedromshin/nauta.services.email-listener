---
phase: 28-design-system-token-upgrades
verified: 2026-07-07T02:10:44Z
status: gaps_found
score: 3/4 roadmap success criteria verified (1 partial/failed); 5/5 TOKEN-01..05 requirements satisfied at the CSS-token/value level
overrides_applied: 0
gaps:
  - truth: "Chart series colors and the sidebar visibly use teal-derived hues instead of stock shadcn demo colors (ROADMAP Phase 28 Success Criterion #2, second clause)"
    status: failed
    reason: >
      The --sidebar-* CSS custom properties in globals.css ARE correctly rebased (--sidebar-ring:
      var(--primary), etc.) — this part of TOKEN-02 is genuinely done. But the ONLY live sidebar in
      the app, AppSidebar (apps/web/src/components/app-sidebar.tsx, rendered on every page via
      layout.tsx), uses packages/ui/src/sidebar.tsx's shadcn Sidebar primitive, whose className
      strings reference bg-sidebar, bg-sidebar-accent, ring-sidebar-ring, border-sidebar-border
      extensively. NONE of these are registered as Tailwind color utilities in any config file that
      actually compiles the app (base.ts / web.ts / apps/web/tailwind.config.ts) — colors.sidebar is
      defined ONLY in packages/ui/tailwind.config.ts, whose own top comment reads "This file is not
      used for any compilation purpose, it is only used for Tailwind Intellisense & Autocompletion."
      Confirmed against the real compiled build (apps/web/.next/static/css/app/layout.css, which
      includes AppSidebar via the root layout): zero .bg-sidebar*/.ring-sidebar-ring*/.border-sidebar-*
      rules exist anywhere in it, and the file's global --tw-ring-color default is Tailwind's stock
      "rgb(59 130 246 / 0.5)" (blue-500) — the exact "accidental blue" the phase's own 28-CONTEXT.md
      says TOKEN-02 must kill ("kill the accidental blue --sidebar-ring by pointing it at the teal
      ring"). Because ring-sidebar-ring never generates, focus-visible:ring-2 on a SidebarMenuButton
      still falls through to that stock blue default — the ring is NOT teal in the rendered app,
      contradicting both the ROADMAP SC and TOKEN-02's own stated intent. This is a PRE-EXISTING gap
      (packages/ui/src/sidebar.tsx, packages/ui/tailwind.config.ts, and apps/web/tailwind.config.ts
      are all untouched by Phase 28's commits — verified via `git log b95f953..HEAD` on those 3
      files, zero hits) that Phase 28's own research premise ("No surface currently consumes
      sidebar-* heavily") got factually wrong, so the phase's value-only fix is invisible on the one
      sidebar that exists. The chart-1..5 half of this same success criterion is NOT a gap — chart-*
      genuinely has zero consumers anywhere in the app (packages/ui/src/chart.tsx exists but is not
      imported anywhere under apps/web/src), which the UI-SPEC and 28-01-SUMMARY.md both document
      transparently as an intentional, forward-looking value-only fix (no chart feature exists to
      wire up) — that framing is honest and is not being disputed here.
    artifacts:
      - path: "packages/tailwind-config/base.ts"
        issue: "theme.extend.colors has no `sidebar` key, so bg-sidebar/bg-sidebar-accent/ring-sidebar-ring/border-sidebar-border never compile to real CSS in the actual apps/web build"
      - path: "packages/ui/tailwind.config.ts"
        issue: "Defines colors.sidebar but is explicitly IDE-only (\"not used for any compilation purpose\" per its own header comment) — does not affect the real build"
      - path: "apps/web/src/components/app-sidebar.tsx"
        issue: "The only live sidebar consumer in the app; its internal SidebarMenuButton focus ring silently falls back to Tailwind's stock blue-500 default because ring-sidebar-ring doesn't resolve"
    missing:
      - "Register a `sidebar` color family (aliasing --sidebar-background/-foreground/-primary/-accent/-border/-ring, mirroring packages/ui/tailwind.config.ts's shape) in the REAL config chain (packages/tailwind-config/base.ts or web.ts) so bg-sidebar/ring-sidebar-ring/etc. actually generate, OR explicitly accept/override this as a known pre-existing gap outside Phase 28's practical reach and track it as backlog"
human_verification:
  - test: "Screenshot the main /chat + /studio surfaces in both light and dark mode and compare against pre-Phase-28 baselines"
    expected: "The change reads as \"the same app, slightly more defined\" — not a retheme (28-CONTEXT.md's max-drift guard; all 6 changed neutrals stay within ≤2.8 lightness points of baseline, already computed and verified by the committed contrast test, but overall visual gestalt still needs a human eye)"
    why_human: "Visual gestalt/perception judgment — cannot be reduced to a numeric gate"
  - test: "With the /chat dev server up, drop/generate a genui panel on the canvas; confirm it fades+zooms in once on mount (not on drag, stream update, or selection toggle); select the node and confirm the shadow visibly lifts (elevation-1 -> elevation-2 alongside the ring); then enable OS-level prefers-reduced-motion and confirm the entrance is fully cancelled"
    expected: "Single fade+zoom entrance on mount only; visible shadow lift on selection; zero motion under reduced-motion"
    why_human: "Real-time animation/motion behavior and OS-level reduced-motion state cannot be verified by static grep — code-level wiring was confirmed (className strings present exactly as specified, applied to GenuiPanelNode's outer shell only, never to GenuiPanelNodeBody/GenuiPartBoundary/InteractiveWidgetBoundary/SpecRenderer) but the runtime behavior itself needs a live check"
  - test: "With the /studio dev server up, open the History tab and the Page Ideas tab; confirm list items cascade in with a visible stagger (first ~6 items staggered 0/40/80/120/160/200ms, rest appear flat at 200ms); then enable reduced-motion and confirm items appear immediately with no cascade"
    expected: "Visible capped stagger on initial render/filter change; immediate appearance with reduced-motion"
    why_human: "Real-time animation/motion behavior; code-level wiring (Math.min(index,5)*40 formula, animate-in classes, motion-reduce:animate-none) was confirmed by direct grep against both files, but the visual cascade itself needs a live check"
  - test: "With the /chat dev server up, populate the canvas with >=3 overlapping genui panels behind the conversation rail, open the rail, and confirm conversation-row text/hover states read cleanly with no distracting canvas-content bleed-through now that backdrop-blur-md has been replaced with bg-background/95"
    expected: "Clean, legible rail content over live canvas panels with no bleed-through; if bleed-through is visible, 28-UI-SPEC.md's Fallback 1 (drop to fully opaque bg-background) should be applied and the bans-doc closure note updated accordingly"
    why_human: "The UI-SPEC itself frames this as an execution-time visual check against arbitrary, moving canvas content, not a static WCAG-style computation — explicitly deferred to a human/live check by the phase's own design contract"
---

# Phase 28: Design-System Token Upgrades Verification Report

**Phase Goal:** The foundational token layer (`globals.css` + Tailwind preset) stops papering over
gaps with hardcoded values — every surface that consumes `secondary`/`muted`/`accent`, `chart-*`/
`sidebar-*`, shadow, radius, or entrance-animation tokens benefits at once.
**Verified:** 2026-07-07T02:10:44Z (codebase HEAD `5730dc5`)
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Phase 28 Success Criteria — non-negotiable contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `secondary`/`muted`/`accent` render as tonally distinct neutral tones (no longer one shared stock gray) in both light/dark, still 60/30/10-compliant | VERIFIED | `globals.css` lines 23-28 (`:root`) / 65-70 (`.dark`): 6 distinct hue-164 values, none identical; saturation capped at 10-12% (whisper-teal, not a second brand hue); `token-contrast.test.ts` run directly — 6/6 pass, all pairs >=4.5:1 WCAG-AA |
| 2 | Chart series colors and the sidebar visibly use teal-derived hues instead of stock shadcn demo colors | **PARTIAL / FAILED** | Chart half: `--chart-1..5` correctly teal-anchored (globals.css lines 34-38/76-80) — VERIFIED at token level, honestly documented as having zero live consumers yet (no gap). Sidebar half: **FAILED** — see Gaps below; `--sidebar-*` vars are correctly aliased but never reach the DOM because `colors.sidebar` is not registered in any Tailwind config that actually compiles `apps/web` (confirmed via source + compiled build CSS) |
| 3 | A real elevation/shadow scale (`elevation-1/2/3`, teal-tinted) exists in `packages/tailwind-config/base.ts` and is visibly applied; `xl`/`2xl` radius steps exist and `card.tsx` consumes the radius token | VERIFIED | `base.ts` lines 46-50 (`boxShadow.elevation-1/2/3`); `web.ts` lines 22-23 (`borderRadius.xl/2xl`); 4 named consumers confirmed wired verbatim: `card.tsx:12` (`shadow-elevation-1`), `composer.tsx:76` (`shadow-elevation-2`), `chat-node.tsx:150`, `genui-panel-node.tsx:157` (resting/selected elevation split) |
| 4 | Genui panel mount and Studio's history/page-ideas list items visibly animate in via `tailwindcss-animate`, beyond bare Radix open/close transitions | VERIFIED (code-level; visual confirmation pending human check) | `genui-panel-node.tsx:157` carries `animate-in fade-in-0 zoom-in-95 duration-[250ms] motion-reduce:animate-none` on the outer shell only; `history-island.tsx:304-309` and `page-ideas-island.tsx:117-131` both carry `Math.min(index, 5) * 40`ms stagger with the exact class string from the UI-SPEC |

**Score:** 3/4 fully verified; 1 partial (chart clause passes, sidebar clause fails)

### Requirements-Level Truths (TOKEN-01..05, finer grain — all satisfied at the CSS-token/value scope each requirement's own text actually claims)

| Requirement | Status | Evidence |
|---|---|---|
| TOKEN-01 | SATISFIED | Values + contrast test, as above |
| TOKEN-02 | SATISFIED (token/value scope only — REQUIREMENTS.md's own text is "tokens are rebased," which is true; does not claim rendered-DOM effect) | `--chart-*`/`--sidebar-*` values correct; see ROADMAP SC#2 gap above for the stronger "visibly" claim |
| TOKEN-03 | SATISFIED | elevation vars/config/4 consumers, as above |
| TOKEN-04 | SATISFIED | radius vars/config; `card.tsx`'s `rounded-xl` now resolves through `--radius-xl` via `web.ts`'s `extend` precedence (confirmed by reading `web.ts`'s `borderRadius` block) |
| TOKEN-05 | SATISFIED | mount entrance + list stagger, as above |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/globals.css` | TOKEN-01/02 values, `--elevation-1/2/3`, `--radius-xl/2xl` | VERIFIED | All values byte-match the UI-SPEC's "Final values" tables in both `:root` and `.dark` |
| `packages/tailwind-config/base.ts` | `boxShadow.elevation-1/2/3` | VERIFIED | Present, wired to `var(--elevation-N)` |
| `packages/tailwind-config/web.ts` | `borderRadius.xl/2xl` | VERIFIED | Present, wired to `var(--radius-xl)`/`var(--radius-2xl)`; `tailwindcss-animate` plugin already registered |
| `apps/web/src/app/__tests__/token-contrast.test.ts` | Committed WCAG-AA regression gate | VERIFIED | Exists, runs standalone, 6/6 pass |
| `packages/ui/src/card.tsx` | `shadow-elevation-1` consumer | VERIFIED | Line 12 exact match |
| `apps/web/src/app/chat/_components/composer.tsx` | `shadow-elevation-2` consumer | VERIFIED | Line 76 exact match |
| `apps/web/src/app/chat/_canvas/chat-node.tsx` | resting/selected elevation split | VERIFIED | Line 150 exact match |
| `apps/web/src/app/chat/_canvas/genui-panel-node.tsx` | elevation split + mount entrance | VERIFIED | Line 157 exact match; entrance classes confirmed scoped to outer shell only |
| `apps/web/src/app/studio/_components/history-island.tsx` | capped-6 stagger | VERIFIED | Lines 304-309 exact match |
| `apps/web/src/app/studio/_components/page-ideas-island.tsx` | capped-6 stagger via `index` prop | VERIFIED | Lines 117-131, 358-362 exact match |
| `apps/web/src/app/chat/_components/conversation-rail.tsx` | blur removed, `bg-background/95` | VERIFIED | Line 111 exact match, no `backdrop-blur` anywhere in file |
| `docs/design/product-register-and-bans.md` | item-3 resolved note + item-10 radius allowlist | VERIFIED | Both notes present verbatim with citation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `base.ts` `boxShadow.elevation-N` | `globals.css` `--elevation-N` | `var(--elevation-N)` | WIRED | Confirmed both directions |
| `web.ts` `borderRadius.xl/2xl` | `globals.css` `--radius-xl/2xl` | `var(--radius-xl)` | WIRED | Confirmed |
| `genui-panel-node.tsx` outer shell | `tailwindcss-animate` plugin | `animate-in`/`fade-in-0`/`zoom-in-95` classes | WIRED | Plugin registered in `web.ts`; classes present, scoped correctly (never inside `GenuiPanelNodeBody`/boundaries — confirmed via reading full file) |
| `globals.css` `--sidebar-ring: var(--primary)` | `packages/ui/src/sidebar.tsx`'s `ring-sidebar-ring` className | Tailwind `colors.sidebar.ring` registration | **NOT WIRED** | No `colors.sidebar` entry in any config that compiles `apps/web` — the CSS variable is correct but has no Tailwind utility class to carry it into the DOM on the one live sidebar consumer |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Effect | Status |
|----------|---------------|--------|----------------------|--------|
| `genui-panel-node.tsx` mount entrance | static className string (no runtime state) | n/a — pure CSS/Tailwind | Yes — `tailwindcss-animate` plugin is registered and generates the utilities | FLOWING |
| `history-island.tsx` / `page-ideas-island.tsx` stagger | `index` (mapped from array position) | `rows.map`/`filtered.map` | Yes — `animationDelay` inline style computed per-item | FLOWING |
| `card.tsx`/`composer.tsx`/`chat-node.tsx`/`genui-panel-node.tsx` elevation | static className string | `boxShadow.elevation-N` in `base.ts` -> `var(--elevation-N)` in `globals.css` | Yes | FLOWING |
| `AppSidebar` sidebar-* accent/ring/border | static className string in `packages/ui/src/sidebar.tsx` | `colors.sidebar.*` — **never registered** in the real build config | **No** | **DISCONNECTED** — variable is correct but has no Tailwind utility to consume it in the actual rendered DOM |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Contrast regression gate passes standalone | `npx vitest run src/app/__tests__/token-contrast.test.ts` (apps/web) | 6/6 tests passed | PASS |
| Full web test suite unaffected | `npx vitest run` (apps/web, run once) | 24 files / 174 tests passed | PASS |
| Typecheck clean | `npm run typecheck` (apps/web) | Clean, no errors | PASS |
| Locked files untouched across phase range | `git log b95f953..HEAD -- <3 locked files>` | Zero commits touch `spec-renderer.tsx`/`genui-part-boundary.tsx`/`interactive-widget-boundary.tsx` | PASS |
| Zero new dependencies | `git diff b95f953..HEAD --stat -- package.json */package.json` | No diff | PASS |
| `sidebar` Tailwind color registered in real build | source read of `base.ts`/`web.ts`/`apps/web/tailwind.config.ts` + compiled `.next/static/css/app/layout.css` grep | Not found in any of the 3 real configs; zero `.bg-sidebar*` rules in compiled output despite `AppSidebar` being rendered on every page | **FAIL** |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TOKEN-01 | 28-01 | secondary/muted/accent tonal differentiation | SATISFIED | See truths table |
| TOKEN-02 | 28-01 | chart-1..5 + sidebar-* rebase off teal primary | SATISFIED at token/value scope (REQUIREMENTS.md's literal text); ROADMAP's stronger "visibly" framing partially fails (sidebar half — see gap) | See truths table + gap |
| TOKEN-03 | 28-01 (vars) / 28-02 (consumers) | elevation/shadow scale | SATISFIED | See truths table |
| TOKEN-04 | 28-01 (vars) / 28-03 (docs) | xl/2xl radius steps + card.tsx | SATISFIED | See truths table |
| TOKEN-05 | 28-02 (a) / 28-03 (b) | entrance/stagger animation | SATISFIED | See truths table |

No orphaned requirements — REQUIREMENTS.md's "Last updated" line confirms 23/23 v1.4 requirements mapped, TOKEN-01..05 all attributed to Phase 28.

### Anti-Patterns Found

None. Scanned all 12 phase-modified files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/"coming soon" — zero matches.

### Human Verification Required

See frontmatter `human_verification` — 4 items harvested from `<human-check>` blocks across all 3 PLAN.md files (28-01, 28-02 x1, 28-03 x2), all explicitly deferred by the executor's own SUMMARY.md "Manual Verification Deferred" sections since this project runs in `yolo`/`skip_checkpoints` mode. All are visual/motion/live-canvas checks that cannot be reduced to a static code check.

### Gaps Summary

One gap, scoped narrowly: the **sidebar half** of ROADMAP Success Criterion #2 is not actually true in
the rendered app. Phase 28 correctly rebased every `--sidebar-*` CSS custom property (including
killing the literal blue HSL value that used to sit in `--sidebar-ring`), but the ONE live sidebar
in the app (`AppSidebar`, wrapping `packages/ui/src/sidebar.tsx`'s shadcn primitive) references
Tailwind utility classes (`bg-sidebar`, `bg-sidebar-accent`, `ring-sidebar-ring`,
`border-sidebar-border`) that were never registered as a `colors.sidebar` family in any Tailwind
config that actually compiles `apps/web` — only in an explicitly IDE-only, non-compiling config file
(`packages/ui/tailwind.config.ts`). This means those classes are dead/no-op strings in the real
build (confirmed against the actual compiled CSS, which shows zero matching rules despite
`AppSidebar` rendering on every page), and Tailwind's global default ring color
(`rgb(59 130 246 / 0.5)`, stock blue-500) is what a keyboard-focused sidebar menu item actually shows
— the exact "accidental blue `--sidebar-ring`" the phase's own `28-CONTEXT.md` explicitly says
TOKEN-02 must kill. This bug pre-dates Phase 28 (none of `packages/ui/src/sidebar.tsx`,
`packages/ui/tailwind.config.ts`, or `apps/web/tailwind.config.ts` were touched by any Phase 28
commit) and stems from a factually incorrect research premise carried from `28-CONTEXT.md` ("No
surface currently consumes sidebar-* heavily") into the UI-SPEC and execution — the premise is
false; a real, live, always-rendered consumer exists. The chart-1..5 half of the same success
criterion is NOT a gap: `chart-*` genuinely has zero consumers anywhere in the app today, and both
the UI-SPEC and 28-01-SUMMARY.md transparently document this as an intentional forward-looking
value-only fix (no chart feature exists yet to wire up).

**This looks like it could be an accepted, pre-existing platform gap outside Phase 28's practical
reach** (fixing it means registering a new Tailwind color family, which 28-CONTEXT.md explicitly
locked out of scope: "would be new utility surface... this phase does not add one"). If the user
judges that closing it belongs to Phase 28 anyway (since the roadmap's own success criterion
explicitly promises the "visibly use" / "kill the blue ring" outcome), route it to a follow-up plan
that registers `colors.sidebar` in `packages/tailwind-config/base.ts` (aliasing the existing
`--sidebar-*` vars, mirroring `packages/ui/tailwind.config.ts`'s already-correct shape) so
`bg-sidebar`/`ring-sidebar-ring`/etc. finally compile. Alternatively, if the user judges this was
always out of Phase 28's intended reach (a token-VALUE-only phase, explicitly not touching Tailwind
utility surface), accept it with an override:

```yaml
overrides:
  - must_have: "Chart series colors and the sidebar visibly use teal-derived hues instead of stock shadcn demo colors"
    reason: "Sidebar CSS variables are correctly rebased; the missing Tailwind colors.sidebar utility registration is a pre-existing platform gap outside this token-VALUE-only phase's locked scope (28-CONTEXT.md explicitly excludes adding new Tailwind utility surface). Accepted as backlog."
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

---

*Verified: 2026-07-07T02:10:44Z*
*Verifier: Claude (gsd-verifier)*
