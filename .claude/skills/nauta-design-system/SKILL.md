---
name: nauta-design-system
description: Nauta web design system — token source, @nauta/ui conventions, and the shadcn CLI + registry vendor-and-adapt workflow. Use when building, styling, or reviewing any UI in apps/web or packages/ui.
---

# Nauta Design System

## Stack pin (hard constraints)

- Tailwind **v3.4** + React **18** + Next 15. NOT Tailwind v4, NOT React 19.
- Primitives: **Radix** (`@radix-ui/react-*`). Upstream shadcn defaults to Base UI
  since July 2026 — stay on the Radix track; diff any payload before vendoring.
- Third-party registry payloads are increasingly Tailwind v4 (`@theme`, oklch).
  Adapt to v3 (HSL variables + tailwind.config) before committing. Never
  auto-install blindly.

## Where things live

- Components: `packages/ui/src/*.tsx` — FLAT, one file per component
  (no `components/ui/` nesting). Includes vendored clones from Magic UI
  (border-beam, marquee, confetti, number-ticker, …) and Kibo UI (code-block,
  dropzone, dialog-stack, tags, …) — already adapted to Tailwind v3; their
  keyframes live in `packages/tailwind-config/web.ts`.
- `cn` util: exported from the `@nauta/ui` root (`packages/ui/src/index.ts`).
- Tokens: `apps/web/src/app/globals.css` — HSL CSS variables, shadcn v3
  convention. Brand primary `164 39% 22%`. Sidebar tokens extended in
  `packages/ui/tailwind.config.ts` (IntelliSense-only file).
- Tailwind preset: `@nauta/tailwind-config/web`.
- Import convention: `import { Button } from "@nauta/ui/button"`,
  `import { cn } from "@nauta/ui"`.
- This is an **npm workspaces** monorepo (NOT pnpm).
  Typecheck: `npm run typecheck -w @nauta/ui`.

## Component discovery — read the catalog, don't search

**When composing a page, read `references/component-catalog.md` FIRST.** It
pre-enumerates every available component — all 55 local `@nauta/ui` components
(including vendored Magic UI effects and Kibo UI utilities) plus all ~900
registry items (@shadcn, @kibo-ui, @magicui, @coss) with descriptions — so you
never need to stop and run `shadcn search` mid-build. Prefer local components
first; they have zero adaptation cost.

Refresh the catalog when registries drift or new components are vendored:
`node .claude/skills/nauta-design-system/scripts/build-catalog.mjs`

## shadcn CLI workflow (vendor + adapt)

`packages/ui/components.json` wires the CLI and registries. Run from
`packages/ui/`.

- Discover: catalog first (above); fall back to `npx shadcn@latest search @kibo-ui -q <term>`
- Inspect: `npx shadcn@latest add <item> --dry-run --view`
  (import rewriting to `@nauta/ui` conventions is correct in the payload)
- Diff vendored components against canonical: `npx shadcn@latest diff <name>`
- **DO NOT run plain `add`** — it resolves the write path through the package
  `exports` map and targets `src/index.ts/<name>.tsx` (broken). Instead:
  1. Copy the payload from `--dry-run --view` into `packages/ui/src/<name>.tsx`.
  2. Adapt Tailwind v4 syntax to v3 if present.
  3. Swap Base UI primitives for the Radix equivalent (or justify an exception).
  4. Add runtime deps to `packages/ui/package.json`; `npm install` at root.

## Approved external sources

| Registry | Use for | Caveat |
|---|---|---|
| `@shadcn` (canonical) | app UI staples | Base UI default since 2026-07 — diff first |
| `@kibo-ui` | complex app components (Gantt, Kanban, AI chat, dropzone) | v4-leaning payloads |
| `@coss` (ex-Origin UI) | input/button/dialog variants | Base UI-based now |
| `@magicui` | animated effects, polish | v4 + Motion; v3 legacy docs at v3.magicui.design |
| `@tweakcn` | theme presets | generate, then hand-port variables into globals.css `:root` |

- 21st.dev Magic MCP: do not use (abandoned early 2026).
- shadcn MCP server: intentionally not wired — the skills + CLI path is
  preferred (lower token cost; GSD subagents with `tools:` restrictions
  can't see MCP tools anyway).

## Gotchas

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

## Design quality bar

- The `frontend-design` plugin skill (user scope) sets the aesthetic floor —
  follow it for any new surface.
- Verify UI work visually: run the app and screenshot via the existing
  playwright-core loop before declaring it done.
- GSD integration: this file is auto-read by `gsd-ui-researcher` during
  `/gsd:ui-phase` and by `gsd-ui-auditor` during `/gsd:ui-review`. Keep it
  current when tokens or conventions change.
