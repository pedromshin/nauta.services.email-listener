# Taste inventory — component packs reachable tonight

Scope: what's already in `packages/ui/src`, the proven registry-install workflow (STCK-04),
and pack picks for tonight's likely surfaces (file/folder tree, upload dropzone, file preview,
terminal/console frame, long-form report layout, citation/footnote, filter/rule builder, command
palette, empty states). Palette/typography are LOCKED (D-58-01) — every pack piece needs re-skin
onto the oklch ladder + law 1 (monochrome chrome) + law 2 (serif = evidence only). References are
mined for layout/density/hierarchy/interaction, never for colour or type.

## Proven workflow (STCK-04, `packages/ui/src/rating.tsx` is the receipt)

From `.claude/skills/polytoken-design-system/SKILL.md` + `55-06-SUMMARY.md`:

1. Discover via `references/component-catalog.md` first (55 local + ~900 registry items
   pre-enumerated) — don't run `shadcn search` mid-build.
2. Inspect: `npx shadcn@latest add <ns>/<name> --dry-run --view` from `packages/ui/`.
3. **DO NOT run plain `add`** — it resolves the write path through this package's `exports` map
   and targets a broken location. Copy the `--dry-run --view` payload verbatim into
   `packages/ui/src/<name>.tsx` instead.
4. A v4/oklch-native payload (most of @kibo-ui, @magicui, @coss now) typically needs **zero**
   adaptation to the Tailwind/Radix shape — proven live for `@kibo-ui/rating`. Adaptation is only
   needed when a payload assumes a different token shape, OR (universally, every pack) when it
   ships literal colour classes that must be re-skinned onto `--conf`/`--sugg`/`--bad`/`--ink`
   and stripped of any non-earned hue (law 1) — that re-skin step is NOT optional for any pack
   piece regardless of Tailwind-version compatibility.
5. `-b radix`/`--base` is `init`-only, not a per-`add` flag; this repo's `style: "new-york"`
   already pins `@shadcn` items to Radix. Third-party registries have no toggle — read the
   payload's own imports to confirm Radix (not Base UI) before vendoring.
6. Add any new runtime dep to `packages/ui/package.json`, checking first — many are already
   installed (e.g. `@radix-ui/react-use-controllable-state`).
7. Wire it on `/dev/components` (visual smoke) and, if it renders a new pattern, regenerate
   `/dev/design` data via `build-design-data.mjs`.

Approved registries only: `@shadcn` (canonical), `@kibo-ui`, `@coss` (ex-Origin UI, now Base-UI
based — diff before vendoring), `@magicui`, `@tweakcn` (theme presets — **never** hand-port a
generated preset wholesale, it violates law 1). Aceternity-class libraries and ReUI are **not**
in the approved list; treat any pull from them as a new registry needing the same vet Origin UI/
Kibo got, not a drop-in.

## Per-need verdicts

| Need | Best pick | Install | Adaptation cost |
|---|---|---|---|
| **File/folder tree** | `@kibo-ui/tree` — composable, animated expand/collapse, customizable nodes (already in local catalog, 41-item @kibo-ui list) | `npx shadcn@latest add @kibo-ui/tree --dry-run --view` from `packages/ui/`, then copy-in per the STCK-04 workflow | Low. Re-skin node rows onto `--ink`/`--faded`/`--rule`, drop any accent-colour selection state to an ink outline (canvas-card language precedent already does this), and swap any file-type colour-coding for law-3 shape glyphs if entity-adjacent. `@magicui/file-tree` is a second option but it's an animation/demo component, not a real interactive tree — prefer kibo's. |
| **Upload dropzone** | Already local: `packages/ui/src/dropzone.tsx` (kibo-derived, `react-dropzone` already a dep) | None — it's vendored and adapted already | Zero — just confirm current call sites use it rather than re-rolling. Verify its drag-active state uses ink/rule, not a stock accent. |
| **File preview** | No dedicated local component. `@kibo-ui/image-crop` / `@kibo-ui/image-zoom` cover image preview; there is no generic "file preview" (PDF/doc) piece in any approved registry. | Hand-roll a thin wrapper: reuse `code-block.tsx` (shiki) for text/code previews, `<img>` + `image-zoom` for images, and a plain iframe/embed frame for PDFs styled with the `p-panel` density token and `--rule` border | Medium (hand-roll), but low risk — this is app-shell composition, not a component with baked-in styling to fight. |
| **Terminal/console frame** | `@magicui/terminal` — a terminal-chrome component built for exactly this | `npx shadcn@latest add @magicui/terminal --dry-run --view`, copy-in; `motion` package already a dep so the typing/fade choreography carries over | Low-medium. MagicUI ships with dark-terminal-styled chrome (window dots, monospace) — the window-dot/frame chrome is fine to keep (it's decorative furniture, not a "meaning" colour per law 1), but any green/red terminal-output colours must be re-skinned to ink or the tier hues if they're signaling confirmed/suggested/irreversible; otherwise plain ink on `--shade`/`--bright`. |
| **Long-form report/document layout** | No pack — this is a layout pattern, not a component. Hand-roll on top of existing primitives: `Separator`, `ScrollArea`, the type-scale (`text-base`/`text-lg` at 14px/1.55 body), `font-serif` for the user's own extracted content per law 2 | N/A (layout composition) | N/A — this is exactly the kind of surface D-58-01 says the identity is for; no registry piece should be reached for here, it'd fight law 2's serif/sans split immediately. |
| **Citation/footnote treatment** | No component in any approved registry (Kibo's AI/chat primitives migrated OUT to Vercel's `@ai-elements` registry — not on the approved list, would need separate vetting). Kibo's `glimpse` (hover preview of a URL) is the closest adjacent primitive for a citation hover-card. | If pursued: `npx shadcn@latest add @kibo-ui/glimpse --dry-run --view` for the hover-preview mechanics only | This repo already HAS the real answer and it's better than any pack: **`pmark`/`pmark-confirmed`/`pmark-suggested`** (the provenance mark, `apps/web/src/app/_components/entity-chips.tsx`) is the one mark language for cited spans — solid/dashed underline exactly encodes confirmed-vs-suggested provenance, which is more precise than a generic footnote-number pattern. **Verdict: hand-roll (reuse `pmark`), do not reach for a pack.** |
| **Rules/filter builder** | No component in any approved registry ships a real filter/query builder. `react-querybuilder` has a shadcn-adapter package (`react-querybuilder-shadcn-ui`, community, unaudited) and ReUI has a "Filters" component — neither is on the approved-registry list. | If genuinely needed tonight: hand-roll a simple filter row (field select + operator select + value input, using existing `Select`/`Input`/`Badge`) rather than pulling an unvetted third-party dep | High if a pack is pulled (react-querybuilder brings its own state-management/styling assumptions that fight the token system and would need a real vet before landing — treat as a backlog item, not tonight's work). Low if hand-rolled from existing primitives for a single filter use case. |
| **Command palette** | Already local and already wired: `packages/ui/src/command.tsx` — `cmdk` **is** in `packages/ui/package.json` dependencies (`"cmdk": "^1.0.0"`) | None | Zero — it exists, don't reinstall. `@kibo-ui/combobox` (autocomplete + command-palette-with-suggestions) is an upgrade path only if the existing `command.tsx` is missing a specific behavior (e.g. async-loaded suggestions); check `command.tsx` before reaching for it. |
| **Empty states** | `@shadcn/empty` — canonical composable primitive (`Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`), already indexed in the catalog (`p-empty-1` preview slot exists) | `npx shadcn@latest add empty --dry-run --view` (canonical @shadcn registry, no namespace prefix needed), copy-in per workflow | Low. It's structural (icon/media slot + title + description + action slot), no baked colour to fight — style the media slot with `--faded`/`--pencil` ink tones and route any action button through the existing `Button` component. SKILL.md already names "framed error/empty states" as a `p-panel` density use case — reuse that spacing token. |

## Reachability verdict for tonight

- **Zero-cost, already done:** dropzone, command palette (cmdk), citation/footnote (pmark already
  is the better answer than any pack).
- **Cheap, proven-workflow installs (do these):** `@shadcn/empty`, `@kibo-ui/tree`,
  `@magicui/terminal` — each is a single `--dry-run --view` + copy-in, all Radix/v4-native by the
  ecosystem's current default, all need only the standard re-skin-to-tokens pass (strip any baked
  accent colour to ink, keep structural chrome).
- **Hand-roll, don't pack-shop:** file preview (composition of existing primitives), long-form
  report layout (pure layout, packs would fight law 2), filter/rule builder (no approved-registry
  option exists; a real query-builder dep is a backlog-worthy vet, not a tonight pull).
- **Explicitly out of scope tonight:** Vercel `@ai-elements` registry (citation-shaped AI
  components live there now post-Kibo-migration) and `react-querybuilder`/ReUI filters — neither
  is on this repo's approved-registry list (`@shadcn`, `@kibo-ui`, `@coss`, `@magicui`,
  `@tweakcn`); pulling from them tonight would be introducing a new, unvetted supply chain under
  time pressure rather than reusing the proven one.

## Files referenced

- `c:/Users/pc/Desktop/nauta.services.email-listener/packages/ui/src/` (55 local components,
  inventoried above)
- `c:/Users/pc/Desktop/nauta.services.email-listener/packages/ui/components.json` (v4 shape,
  registries: `@kibo-ui`, `@coss`, `@magicui`, `@tweakcn`)
- `c:/Users/pc/Desktop/nauta.services.email-listener/.claude/skills/polytoken-design-system/SKILL.md`
  (proven workflow, laws, gates)
- `c:/Users/pc/Desktop/nauta.services.email-listener/.claude/skills/polytoken-design-system/references/component-catalog.md`
  (pre-enumerated 55 local + 61 @shadcn + 41 @kibo-ui + 246 @magicui + 560 @coss items)
- `.planning/phases/55-platform-migration-tailwind-v4-react-19/55-06-SUMMARY.md` (STCK-04 proof:
  `@kibo-ui/rating` → `packages/ui/src/rating.tsx`, zero adaptation)
- `.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md` (D-58-01, locked
  laws governing every re-skin decision above)
- `apps/web/src/app/_components/entity-chips.tsx` (canonical `pmark` — the citation/footnote
  answer already in the codebase)
