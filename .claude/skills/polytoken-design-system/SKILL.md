---
name: polytoken-design-system
description: Polytoken web design system — token source, @polytoken/ui conventions, and the shadcn CLI + registry vendor-and-adapt workflow. Use when building, styling, or reviewing any UI in apps/web or packages/ui.
---

# Polytoken Design System

## Stack pin (hard constraints)

- Tailwind **v4** (`@theme inline` + oklch tokens, CSS-first config) + React **19** + Next 15.
  Migrated in Phase 55 (STCK-01/STCK-02) — `packages/ui/components.json`'s `tailwind.config`
  is blank (`""`) per the v4 registry-install shape.
- Primitives: **Radix** (`@radix-ui/react-*`) — DECIDED, documented in
  [`docs/design/radix-vs-base-ui.md`](../../../docs/design/radix-vs-base-ui.md) (STCK-03).
  Upstream shadcn defaults to Base UI since July 2026, but its own changelog states Radix is
  not deprecated. `-b radix` is `shadcn init`-only (verified: no `--base` flag exists on
  `add` in the installed CLI) — never re-run `init` against this repo's `components.json`
  without it. This repo's existing `style: "new-york"` already pins canonical `@shadcn` `add`
  calls to Radix with no flag needed (verified live). Third-party registries (`@kibo-ui`,
  `@magicui`, `@coss`) have no Radix/Base-UI toggle at all — diff any payload before vendoring
  regardless.
- Third-party registry payloads are increasingly Tailwind v4-native (`@theme`, oklch) — this
  is now this repo's own shape too, so a v4/oklch payload usually needs **no adaptation**
  (see STCK-04 proof: a direct `shadcn add @kibo-ui/rating` install required zero v3/Base-UI
  changes). Still inspect every payload via `--dry-run --view` first — never auto-install
  blindly — but "adapt Tailwind v4 syntax to v3" is no longer a default step, only a
  contingency if a payload assumes a different token shape than this repo's.

## Where things live

- Components: `packages/ui/src/*.tsx` — FLAT, one file per component
  (no `components/ui/` nesting). Includes vendored clones from Magic UI
  (border-beam, marquee, confetti, number-ticker, …) and Kibo UI (code-block,
  dropzone, dialog-stack, tags, …) — already adapted to Tailwind v3; their
  keyframes live in `packages/tailwind-config/web.ts`.
- `cn` util: exported from the `@polytoken/ui` root (`packages/ui/src/index.ts`).
- Tokens: `apps/web/src/app/globals.css` — full-color-function CSS variables
  (`oklch(...)`), shadcn v4 `@theme inline` convention. **The visual identity
  is D-58-01's 12-token oklch ladder** (locked
  [`58-IDENTITY.md`](../../../.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md),
  realized by Phase 59) — every shadcn semantic name (`--primary`,
  `--background`, `--muted`, `--accent`, ...) is a `var()` reference onto
  that ladder now, never a literal colour. **Under law 1 there is no brand
  primary colour any more** — `--primary`/`--ring` resolve to `--ink` (no
  hue at all); the old stock-derived teal that used to live there is
  deleted from this product entirely (see `59-01-SUMMARY.md`). See
  [`docs/design/brand-guide.md`](../../../docs/design/brand-guide.md) §3
  "Visual identity" for the full palette/type-scale/spacing/signature
  reference — do not duplicate it here, see the pointer below instead.
  Sidebar tokens extended in `packages/ui/tailwind.config.ts`
  (IntelliSense-only file). Call sites read the var directly
  (`var(--primary)`), never re-wrapped in `hsl(...)`.
- Tailwind preset: `@polytoken/tailwind-config/web`.
- Import convention: `import { Button } from "@polytoken/ui/button"`,
  `import { cn } from "@polytoken/ui"`.
- This is an **npm workspaces** monorepo (NOT pnpm).
  Typecheck: `npm run typecheck -w @polytoken/ui`.

## Visual identity (D-58-01) — pointer, not a duplicate

The realized system is documented in
[`docs/design/brand-guide.md`](../../../docs/design/brand-guide.md) §3 "Visual identity"
(palette, type scale, spacing, signature-element usage rules) and locked by
[`58-IDENTITY.md`](../../../.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md)
(D-58-01) — read those as the authority. Do not build a surface without reading §3 first; the
summary below exists only so this file stops being wrong, not to replace it.

- **Law 1** — colour is earned, never decorative: chrome is monochrome, only
  `--conf`/`--sugg`/`--bad` carry hue, and every action/selection/focus-ring is ink.
- **Law 2** — chrome speaks sans, evidence speaks serif: `font-serif` is reserved for the user's
  own material (mail, saved sources, values pulled out of them) — no exceptions, ever.
- **Law 3** — entity type is shape, never hue: use the `tshape`/`tshape-supplier`/`tshape-person`/
  `tshape-amount`/`tshape-document`/`tshape-email` utilities, never a per-type colour. Type shapes
  only belong where there's no room for a word (filter rails, canvas nodes).
- **Signature (THE provenance mark):** `pmark pmark-confirmed` (solid border/wash) /
  `pmark pmark-suggested` (dashed border/wash) — the one mark language for entity chips, cited
  spans inside chat answers, and knowledge entity labels. Reuse it; do not rebuild a chip.
- **Type scale:** `text-2xs`/`text-xs`/`text-sm`/`text-base`/`text-lg`/`text-xl` — this REPLACES
  stock Tailwind sizing app-wide, anchored on a 14px/1.55 body, not Tailwind's 16px default. Use
  `tabular` for amounts/dates/counts.
- **Gates (all committed under `apps/web/src/app/__tests__/`):** `token-contrast.test.ts`
  (WCAG-AA on every semantic pair), `colour-law.test.ts` (law 1 — chrome ceiling, earned-hue
  floor, cross-theme hue/chroma invariance), `token-registration.test.ts` (every declared token
  family has a `@theme` mapping), `palette-ban.test.ts` (no raw Tailwind palette classes in app
  source). Run `cd apps/web && npx vitest run src/app/__tests__/` before/after any `globals.css`
  edit.

## Component discovery — read the catalog, don't search

**When composing a page, read `references/component-catalog.md` FIRST.** It
pre-enumerates every available component — all 55 local `@polytoken/ui` components
(including vendored Magic UI effects and Kibo UI utilities) plus all ~900
registry items (@shadcn, @kibo-ui, @magicui, @coss) with descriptions — so you
never need to stop and run `shadcn search` mid-build. Prefer local components
first; they have zero adaptation cost.

Refresh the catalog when registries drift or new components are vendored:
`node .claude/skills/polytoken-design-system/scripts/build-catalog.mjs`

## shadcn CLI workflow (vendor + adapt)

`packages/ui/components.json` wires the CLI and registries — `tailwind.config` is
blank (v4 shape, per shadcn v4 docs: "For Tailwind CSS v4, leave this blank"). Run
from `packages/ui/`.

- Discover: catalog first (above); fall back to `npx shadcn@latest search @kibo-ui -q <term>`
- Inspect: `npx shadcn@latest add <item> --dry-run --view`
  (import rewriting to `@polytoken/ui` conventions is correct in the payload; `-b`/`--base` is
  `init`-only in the installed CLI — there is no per-`add` override, see
  `docs/design/radix-vs-base-ui.md` §4)
- Diff vendored components against canonical: `npx shadcn@latest diff <name>`
- **DO NOT run plain `add`** — it resolves the write path through the package
  `exports` map and targets `src/index.ts/<name>.tsx` (broken). Instead:
  1. Copy the payload from `--dry-run --view` into `packages/ui/src/<name>.tsx`.
  2. **Since this repo's own tokens are now Tailwind v4/oklch (Phase 55), a v4-native
     payload usually needs NO adaptation** — verified live for `@kibo-ui/rating`
     (STCK-04 proof: the payload's classes, imports (`@polytoken/ui` convention
     already matched), and Radix-based runtime hook all landed unmodified). Only
     adapt if the payload assumes a different token/class shape than this repo's.
  3. Confirm the payload's own primitive import is Radix (`@shadcn` items: this repo's
     `style: "new-york"` already pins that with no flag needed, verified live; third-party
     registries have no toggle — read the payload's own imports at `--dry-run --view` time).
     If a needed component is Base-UI-only, treat that as the re-evaluation trigger in
     `docs/design/radix-vs-base-ui.md`, not a silent exception.
  4. Add runtime deps to `packages/ui/package.json` (check first — a dep may
     already be present, e.g. `@radix-ui/react-use-controllable-state` was
     already installed for `relative-time`/`dialog-stack`/`code-block`); `npm
     install` at root if a new one is needed.

## Approved external sources

| Registry | Use for | Caveat |
|---|---|---|
| `@shadcn` (canonical) | app UI staples | Base UI default since 2026-07 — diff first |
| `@kibo-ui` | complex app components (Gantt, Kanban, AI chat, dropzone) | v4-leaning payloads |
| `@coss` (ex-Origin UI) | input/button/dialog variants | Base UI-based now |
| `@magicui` | animated effects, polish | v4 + Motion; v3 legacy docs at v3.magicui.design |
| `@tweakcn` | theme presets | **do not hand-port a generated preset wholesale** — it would violate law 1 (chrome must stay monochrome, D-58-01) and fail `colour-law.test.ts`; the identity ladder in §3 of `docs/design/brand-guide.md` is this repo's only source for token values now |

- 21st.dev Magic MCP: do not use (abandoned early 2026).
- shadcn MCP server: intentionally not wired — the skills + CLI path is
  preferred (lower token cost; GSD subagents with `tools:` restrictions
  can't see MCP tools anyway).

## Gotchas

- **CSS comment text colliding with the token gates — bitten 3x this milestone (Phase 59), real
  hazard, not theoretical.** `globals.css`'s gates (`token-contrast.test.ts`,
  `token-registration.test.ts`) parse the `:root`/`.dark`/`@theme` blocks with a
  comment-UNAWARE regex (`/--([\w-]+):\s*([^;]+);/g`) by design — it does not strip `/* ... */`
  first. Two distinct failure modes, both hit for real during 59-01/59-02:
  1. A literal `*/` inside comment PROSE (e.g. describing `"p-*/gap-*/m-*"` utilities) closes the
     CSS block comment early, leaving the remaining comment text parsed as raw CSS — webpack
     rejects it as an "Unknown word" syntax error.
  2. A comment containing a colon-terminated `--token-name:` substring (e.g. explaining
     `"NOT --pencil: --shade + --pencil computes to..."`) matches the gate's token-parsing regex
     and silently swallows the NEXT real declaration into a bogus captured value, corrupting that
     token's gated value with no build error.
  **The rule:** never write a literal `*/` inside comment prose (reword around it — "p-, gap-,
  m-" not "p-*/gap-*"), and never write a literal `--name:` inside a comment (reword to
  `--name.` or `NOT --name` without the trailing colon). Before committing a `globals.css` change
  with new comment text, scan it yourself for `*/` and `--[\w-]+:` patterns that aren't real
  declarations.
- Edits to `packages/tailwind-config/web.ts` (keyframes/animations) do NOT
  reach a dev server whose `apps/web/.next/cache` predates the edit — the
  transpiled preset is cached. Fix: stop the server, delete
  `apps/web/.next/cache`, restart.
- Stopping `npm run dev` on Windows can orphan the `next dev` child, which
  keeps holding the port. Verify with `Get-NetTCPConnection -LocalPort <port>`
  and kill the owning PID.
- Visual smoke surface: `/dev/components` renders every vendored
  registry component (apps/web/src/app/dev/components/page.tsx) — extend it
  when vendoring more.
- Consultation page: `/dev/design` is the generated design-system reference —
  every component rendered live (49/55; variant matrices driven by extracted
  CVA data) alongside all tokens with light/dark values, motion utilities, and
  each component's props/defaults/variants/token-refs. Preview registry:
  `apps/web/src/app/dev/design/previews-*.tsx`. Regenerate the data after
  token or component changes:
  `node .claude/skills/polytoken-design-system/scripts/build-design-data.mjs`

## Design quality bar

- The `frontend-design` plugin skill (user scope) sets the aesthetic floor —
  follow it for any new surface.
- Verify UI work visually: run the app and screenshot via the existing
  playwright-core loop before declaring it done.
- GSD integration: this file is auto-read by `gsd-ui-researcher` during
  `/gsd:ui-phase` and by `gsd-ui-auditor` during `/gsd:ui-review`. Keep it
  current when tokens or conventions change.
