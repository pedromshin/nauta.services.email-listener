# Screenshot review — 2026-07-10T20-30-05.134Z (Phase 48 Plan 03, D-48-08)

## Why this is a textual artifact, not PNGs

The Phase-47 `screenshot:review` harness (`apps/web/e2e/screenshot-review.spec.ts`)
requires a real Supabase session to render any of the surfaces this plan touched:

- The citation-chip surface (`/chat`, `ToolInvocationResultRow`'s `<ProvenanceLink>`
  chips) is behind the auth middleware.
- The confirmed-good email surface (`/emails/[id]`'s `LayersTreeRow` /
  `ExtractionSummaryPanel` / `ConfirmDenyControls`) is also behind the auth
  middleware, and additionally isn't a harness-covered surface at all (it needs a
  concrete email id from a live DB row, which the harness's static `SURFACES` list
  doesn't carry).

Per the same-run 47-05 artifact (`.planning/ui-reviews/2026-07-10T18-39-30-080Z/index.md`),
every protected route redirects to `/login` with no session — OAuth remains
user-gated per `STATE.md` Deferred Items ("OAuth/deploys/domain still hard-parked").
Re-running the harness in this window would only re-confirm the same
`redirected to /login (no session)` result already on record; it would not show
either changed surface. Standing up a live session to force it would mean
touching `supabase/`/auth config, which is explicitly out of scope for this plan
and this environment.

Per the plan's own fallback instruction (D-48-08 / 48-03-PLAN.md Task 3 /
executor's `important_project_notes`), this artifact instead documents the
before/after via the actual committed diffs — the exact source of visual
truth for a pure className-swap change (no new markup, no new components).

## Before/after 1 — Citation chip pill radius + canvas edge label (Task 1, `0a03b54`)

**File:** `apps/web/src/components/provenance-link.tsx` (`CHIP_CLASS_NAME`)

```diff
- "inline-flex max-w-[160px] items-center gap-1 rounded-md border border-transparent bg-muted px-2 py-1 text-xs font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
+ "inline-flex max-w-[160px] items-center gap-1 rounded-pill border border-transparent bg-muted px-2 py-1 text-xs font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
```

**Visual delta:** `rounded-md` (6px corner radius) -> `rounded-pill` (`--radius-pill:
9999px`, a true stadium/pill shape). The chip is a small (max 160px wide, ~28px
tall) icon+label element — at that aspect ratio a 9999px radius fully rounds
both left and right ends into semicircles, visually converting the previous
"rounded rectangle" chip into a true pill. This is the ONE shared
`<ProvenanceLink>` primitive, so every citation chip in `/chat`
(`ToolInvocationResultRow`) and (later) the Phase-41 knowledge-preview footer
converts at once — confirmed by the component's own doc comment ("decided
once, used twice").

**Also converted (bonus finding, Task 1 instruction to grep for other genuine
pill chips):** `apps/web/src/app/chat/_canvas/data-edge.tsx`'s data-edge label
button (`sourcePath → targetKey`) was the only other `rounded-full` element on
the chat surface carrying label text — same `rounded-md`-shape-preserving swap
to `rounded-pill` (was already visually a pill via Tailwind's built-in
`rounded-full`; now token-driven instead of hardcoded).

## Before/after 2 — Code typography (Task 1, `0a03b54`)

**Files:** `markdown-renderer.tsx` (`Code`, `Pre`), `json-pane.tsx`

- Inline code (`<Code>`, non-fenced branch): `font-mono` -> `font-code`.
- Fenced code blocks (`<Pre>`): no font class -> `font-code` added.
- Studio JSON pane (`<pre>`): `font-mono` -> `font-code`.

**Visual delta:** `font-code` resolves to the same font stack `font-mono`
already used across all 6 style packs in this repo today (`'JetBrains Mono',
'Courier New', Courier, monospace` per the brutalist pack's explicit alias in
48-01; other packs fall back to the same monospace family) — so the rendered
glyphs are visually IDENTICAL today. The change is architectural, not visual:
code typography now resolves through the `typography.code.family` DTCG token
(wired in 48-01) instead of Tailwind's built-in `font-mono` utility, so a
future style-pack author can change every code surface's typeface by editing
one token value instead of grepping call sites.

## Before/after 3 — Confirmed-good success tokens (Task 2, `d36dd46`)

**File:** `apps/web/src/app/emails/[id]/_components/layers-tree-row.tsx`

```diff
- isConfirmed ? "bg-green-50" : ""
+ isConfirmed ? "bg-success/10" : ""
...
- className="h-4 w-4 rounded-full bg-green-500 hover:bg-green-600 text-white ..."
+ className="h-4 w-4 rounded-full bg-success hover:bg-success/90 text-success-foreground ..."
```

**File:** `apps/web/src/app/emails/[id]/_components/extraction-summary-panel.tsx`

```diff
- confirmed: "bg-emerald-500",
+ confirmed: "bg-success",
...
- <p className="... text-emerald-700 dark:text-emerald-400">
+ <p className="... text-success">
```

**File:** `apps/web/src/app/emails/[id]/_components/confirm-deny-controls.tsx`

```diff
- className="h-5 w-5 rounded-full bg-green-500 hover:bg-green-600 text-white ..."
+ className="h-5 w-5 rounded-full bg-success hover:bg-success/90 text-success-foreground ..."
```

**Visual delta:** `color.success`'s per-pack HSL values (set in 48-01, all
computationally WCAG-AA verified >= 4.5:1) sit within the same green hue
family as the replaced Tailwind `green-500`/`emerald-500` shades, so the
on-screen color for the default `polytoken-teal` pack is a close visual match
(a slightly different, WCAG-verified green rather than Tailwind's stock
palette value) — the confirmed-row tint, the confirm dot, and the "In the
entities gallery" label all keep reading as "confirmed/good" at a glance. The
real change: these three surfaces now track the SAME success color as every
other confirmed-good affordance in the app (and flip correctly per style
pack / dark mode via the token, where the old hardcoded Tailwind classes did
not participate in pack switching at all). The DENY button in
`confirm-deny-controls.tsx` and the deny (✗) button in `layers-tree-row.tsx`
are UNCHANGED — still `bg-destructive` — preserving the dossier rule that
success is never used for stop/deny.

## Verification performed (in lieu of live-browser evidence)

- `npm run typecheck -w @polytoken/web` — clean (only the pre-existing,
  already-deferred `apps/web/src/app/dev/design/` scratch-dir errors, unrelated
  to any file this plan touches).
- `npm run test -w @polytoken/web -- src/components/provenance-link.test.tsx`
  — 6/6 pass (no snapshot pinned `rounded-md`; tests assert `href`/text
  content, not classNames, so they're insensitive to this change and remain
  green as expected).
- `grep -Rino "bg-green-\|emerald-\|bg-lime-"` over the three success files —
  zero matches (exit 1) after the edits.

## Gap recorded

Live-browser visual confirmation (an actual screenshot of the pill chip and
the success-token confirmed row rendering in a browser) is DEFERRED pending
the user completing `GOOGLE-OAUTH-RUNBOOK.md` (unblocks a real session) —
tracked in `STATE.md` Deferred Items alongside the other OAuth-gated UAT
items from Phases 43/45. Once a session exists, re-run
`npm run screenshot:review -w @polytoken/web` and additionally extend
`screenshot-review.spec.ts`'s `SURFACES` list with an `/emails/[id]` entry
(needs a concrete email id) to close this gap for real.
