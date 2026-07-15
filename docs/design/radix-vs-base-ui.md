# Radix vs. Base UI — Decision Record (STCK-03)

> Working reference doc, not marketing prose — sits alongside
> [`brand-guide.md`](./brand-guide.md), [`breakpoint-decision.md`](./breakpoint-decision.md), and
> [`hover-active-convention.md`](./hover-active-convention.md). Records the Phase 55 platform-migration
> decision on which headless primitive library `@polytoken/ui` stays on, following shadcn's July 2026
> default-primitive change.

## 1. The decision

**Stay on Radix.** Do not migrate `packages/ui`'s 37 `forwardRef`-based, Radix-wrapping components to
Base UI. This is a documented stance, not a code change — zero `@radix-ui/react-*` package was
swapped, removed, or replaced by this decision.

## 2. What changed upstream, and why it matters here

shadcn's registry CLI (`shadcn@4.13.0`, installed) defaulted new/interactive `init`/`add` runs to
**Base UI** starting July 2026. Left unaddressed, a non-interactive `shadcn add` in this repo's CI or
overnight-agent context could silently start vendoring Base UI payloads into a tree that is 100%
Radix today — a DOM/accessibility-contract mismatch waiting to happen the first time a component
composes a Base UI primitive next to a Radix one.

shadcn's own July 2026 changelog is explicit that this is not a deprecation:

> "Radix is not being deprecated — the team still supports it, and every update and new component
> will ship for both libraries unless a component only exists in Base UI… if an app works, developers
> should keep shipping."
>
> — [ui.shadcn.com/docs/changelog/2026-07-base-ui-default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)

## 3. Rationale

- **Zero forcing function.** Every component in `packages/ui/src/*.tsx` that wraps a primitive
  today works, is accessible, and is styled to this repo's token system. There is no bug, gap, or
  missing capability that Base UI uniquely fixes.
- **Non-trivial blast radius for a swap.** 37 `packages/ui` components use `forwardRef` to wrap a
  `@radix-ui/react-*` primitive. Base UI is not a drop-in Radix replacement — different prop names,
  different composition patterns (e.g. `render` prop vs. `asChild`), different default DOM shape.
  A full swap means re-validating the accessibility and DOM contract of every one of those 37
  components against a different library, for a benefit STCK-03 does not require (the requirement is
  a decided-and-documented stance, not an executed migration).
- **Official non-deprecation statement.** shadcn's own changelog (quoted above) explicitly frames
  Radix as a first-class, continuing-to-ship option — this is not "the old way," it is one of two
  supported tracks.
- **React 19 compatibility already proven.** Phase 55's own research (55-RESEARCH.md, Standard
  Stack table) confirmed every `@radix-ui/react-*` package already pinned in this repo declares
  `react: … || ^19.0 || ^19.0.0-rc` in its peerDependencies at the currently-pinned version — zero
  version bumps were needed for the React 19 migration. Radix is not a legacy-React liability.

## 4. The pin mechanism

Pin the Radix track explicitly wherever the shadcn CLI runs non-interactively (CI, overnight/agent
sessions, this plan's own STCK-04 install) via the `-b radix` flag:

```bash
npx shadcn@latest init -b radix
npx shadcn@latest add -b radix <item>
```

`-b radix` overrides the CLI's own interactive-prompt default (which now points at Base UI) and
forces registry resolution onto the Radix-compatible variant of a component, when the registry ships
both. This repo's `packages/ui/components.json` does not need a persistent config flag for this — the
CLI flag is supplied per-invocation, and the documented vendor-and-adapt workflow (see
`.claude/skills/polytoken-design-system/SKILL.md`) already requires a human/agent to inspect every
payload via `--dry-run --view` before it lands, which is the natural place to also confirm the
resolved payload used Radix (or, if a component is Base-UI-only, to trigger the re-evaluation trigger
below rather than silently vendoring a mismatched primitive).

## 5. Re-evaluation trigger

This decision is not permanent. **Re-open this decision if any of the following occurs:**

- A component this repo genuinely needs ships **Base-UI-only** (no Radix variant available at all)
  — evaluate a targeted, single-component Base UI adoption rather than a wholesale swap.
- shadcn's changelog announces an actual Radix deprecation (end-of-support date, no further
  updates) — re-evaluate the full-migration cost/benefit at that point, on shadcn's timeline, not
  speculatively now.
- A concrete accessibility, performance, or maintenance defect is found in a Radix primitive this
  repo depends on, with no upstream fix path, and Base UI is confirmed to have already solved it.

None of these conditions are met as of this decision (2026-07-15). Until one is, `-b radix` stays the
default for every `shadcn add`/`init` invocation in this repo.

## 6. Scope note

This decision governs `packages/ui`'s own component-vendoring workflow only. It does not restrict
which *registries* are used (`@kibo-ui`, `@magicui`, `@coss`, `@shadcn` — see SKILL.md's "Approved
external sources" table) — only which primitive-library variant is requested from whichever registry
is chosen, when that registry offers a choice.

---

*Phase: 55-platform-migration-tailwind-v4-react-19*
*Established: 2026-07-15 (STCK-03)*
