# taste-terminal — premium terminal/session UI patterns for /sessions

**Scope:** research-only, no code touched. Target: a `/sessions` surface streaming live Claude Code
terminals. Governing constraint: D-58-01 (`.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md`)
is LOCKED — palette and typography are non-negotiable. References below are mined for layout,
density, hierarchy, and interaction only. Never for colour or font choice.

## Locked tokens this must theme onto (from 58-IDENTITY.md, both themes)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--shelf` | oklch(92.4% .014 97.5) | oklch(19.9% .009 59.1) | page ground |
| `--leaf` | oklch(95.1% .011 95.2) | oklch(22.2% .011 60.9) | panel |
| `--bright` | oklch(98.2% .007 97.4) | oklch(26.5% .015 76.2) | elevated sheet |
| `--shade` | oklch(89.9% .016 99.0) | oklch(31.3% .016 75.0) | well / pressed / hover fill |
| `--rule` | oklch(82.1% .021 100.6) | oklch(38.8% .026 78.8) | structural boundary |
| `--hair` | oklch(88.3% .018 99.6) | oklch(32.6% .017 70.9) | lightweight divider |
| `--ink` | oklch(26.7% .015 124.2) | oklch(92.4% .019 83.1) | text + every action/selection/focus |
| `--faded` | oklch(46.6% .021 124.4) | oklch(75.2% .024 78.2) | secondary text |
| `--pencil` | oklch(51.0% .022 119.2) | oklch(65.0% .025 78.1) | muted metadata |
| `--conf` (verdigris) | oklch(49.0% .068 176.3) | oklch(78.0% .068 176.3) | Confirmed — earned only |
| `--sugg` (pencil-amber) | oklch(50.5% .080 78.7) | oklch(78.5% .080 78.7) | Suggested — earned only |
| `--bad` (madder) | oklch(49.4% .126 32.4) | oklch(70.0% .126 32.4) | destructive only, never errors |

Law 1 is the hard constraint for this surface: chrome is monochrome. A terminal UI's instinct is
alarm-red exit codes, green "success" prompts, yellow warnings — **all of that is banned here**.
Process/exit state must be built from ink-weight, rule, fill and shape, not hue. `--bad` may only
appear on a genuinely destructive action (kill session, force-terminate) — never to say "this
command exited 1."

## 8 concrete patterns

1. **Block-based grouping, not raw scrollback (Warp).** Each command + its output is one visually
   bounded unit — collapsible, independently copyable, independently scrollable-to. For streaming
   Claude Code sessions this maps directly: each tool-call / turn becomes a block with its own
   boundary (`--hair` rule + `--leaf`→`--bright` elevation step on hover/focus), not one endless
   pty stream. *Why:* turns a 10,000-line session into a navigable log. *Click impact:* jump-to-block
   replaces manual scroll-and-hunt — this is the single highest-leverage pattern for "minimize
   clicks" on a long-running session.

2. **Collapsed-by-default completed blocks, expanded-by-default active block.** Warp and VS Code
   task output both converge on this: once a command/turn finishes, its body collapses to a
   one-line summary (command text + duration + terminal state glyph); the in-flight block stays
   open and auto-scrolls. *Why:* the user's real question when scanning sessions is "which one
   needs me," not "replay everything." *Click impact:* zero clicks to see current state across N
   sessions; one click to drill into history.

3. **Session list = fuzzy-filterable registry, not a static sidebar (sesh / tmux-sessionx).**
   sesh/sessionx pattern: type-ahead filter over session name + cwd/repo + last-active, live
   preview pane, one keystroke to attach. For `/sessions`: a left rail list where each row shows
   session label, repo/branch, and a state glyph, filterable by keystroke without opening a modal.
   *Why:* the moment there are >5 concurrent Claude Code sessions, linear scanning fails.
   *Click/keystroke impact:* `/` or `cmd+k`-style filter-and-arrow-to-attach beats N clicks of
   scrolling a list.

4. **Preview-before-attach.** sesh's fuzzy finder shows a live preview pane of the target session
   before you commit to switching. For `/sessions`, hovering or arrow-key-highlighting a list row
   should stream/show the last few lines of that session's block log in a side preview, so
   switching sessions is a confirm, not a blind jump. *Why:* prevents the "which one was I in"
   context-loss cost of terminal multiplexing. *Click impact:* removes the attach→realize
   wrong-session→detach→reattach round trip.

5. **State as glyph + ink weight, never hue (law 1 compliance, generalizing VS Code's tab icons).**
   VS Code marks terminal tabs with a check/x/bell icon rather than colour-coding the whole tab.
   Adapt: a session row gets a shape-coded status glyph (open triangle = running/streaming, filled
   dot = waiting on input, hollow ring = idle/done, per entity-shape language already in law 3) in
   `--ink` or `--pencil` weight, plus a subtle pulsing opacity (not colour) for "actively
   streaming." Exit/error state is communicated by an ink-weight badge with text ("exit 1") inside
   a `--rule`-bordered chip, not a red fill. *Why:* this is the exact trap the brief calls out —
   "alarm-red exit codes" is the single most common generic-terminal-UI tell, and it directly
   violates law 1. *Click impact:* none — this is a scan-speed win, not an interaction win, but
   it's the highest-risk genericness failure to pre-empt.

6. **Command input is a distinct sunken well, not flush with output (Warp's input block).**
   Warp visually separates the live prompt/input area from historical output blocks — the active
   input sits in its own raised or inset region at the bottom, always reachable. Map input well to
   `--shade` (pressed into the page) with a `--rule` top border separating it from the scrollable
   block stack above. *Why:* in a streaming-agent context the "send a follow-up" affordance must
   never be confused with historical transcript. *Click impact:* one visually-obvious click target
   instead of hunting for where to type.

7. **Monospace breathing room: generous line-height + horizontal padding inside the block, not the
   pane (Ghostty/iTerm convention).** Ghostty's whole "premium" signal is `window-padding-x/y` +
   line-height tuning — terminal content that isn't jammed edge-to-edge. Apply this at the block
   level: each block gets consistent internal padding (roughly 12–16px horizontal, 1.4–1.6 line
   height) against `--bright`/`--leaf`, not just the outer pane. *Why:* this is the #1
   differentiator the brief names ("padding/line-height around monospace") and the cheapest to get
   wrong by reusing a bare `<pre>`. *Click impact:* none directly, but it's what separates "looks
   like a real product" from "looks like an embedded terminal emulator," which is exactly the
   genericness risk named in the brief.

8. **Split/multi-pane as a deliberate, not default, escape hatch (VS Code split terminal).** VS
   Code's split-terminal (Ctrl+Shift+5) keeps single-session-per-view as the default and treats
   side-by-side as an explicit user action with a visible toolbar affordance, not the base layout.
   For `/sessions`, default to single-session-focus (list + one active transcript) and offer
   split/compare as an opt-in toggle rather than a permanent multi-pane grid. *Why:* matches
   "minimize clicks" — most work is one session at a time; a permanent grid forces the eye to
   partition attention by default. *Click impact:* fewer default panes = faster orientation; split
   is one click away when actually needed.

9. **Scrollback affordance: "jump to now" pill, not silent auto-scroll fighting the user.**
   Convergent pattern across Warp/VS Code/xterm.js showcases: when a user scrolls up into history
   while output keeps streaming, auto-scroll suspends and a small "N new lines / jump to bottom"
   pill appears (bottom-right of the block stack, `--bright` fill, `--rule` border, `--ink` text —
   no hue). *Why:* the anthropics/claude-code issue tracker itself flags scrollback/cursor-drift as
   a live pain point in exactly this kind of surface — this pattern is the standard fix. *Click
   impact:* one click to resync instead of losing place entirely or being yanked to bottom mid-read.

## xterm.js theme mapping — locked tokens onto `ITheme` (both themes)

xterm.js's theme object (`ITheme`) takes literal colour strings (hex/rgb), not CSS custom
properties directly — so this must be computed at runtime from the resolved oklch tokens (read the
computed style of an element carrying the CSS var, or maintain a JS-side mirror of the token table
per theme) and passed to `new Terminal({ theme: {...} })`. Recommended mapping:

| `ITheme` slot | Light token | Dark token | Note |
|---|---|---|---|
| `background` | `--bright` | `--bright` | matches the "elevated sheet" a block sits on, not the page ground |
| `foreground` | `--ink` | `--ink` | primary text/output |
| `cursor` | `--ink` | `--ink` | law 1: no accent colour on the cursor |
| `cursorAccent` | `--bright` | `--bright` | cursor's own background match, keeps block/cursor contrast without hue |
| `selectionBackground` | `--shade` | `--shade` | law 1: selection is a fill, not a hue, per the identity doc explicitly |
| `selectionForeground` | `--ink` | `--ink` | |
| `selectionInactiveBackground` | `--hair` | `--hair` | |
| `black` / `brightBlack` | `--faded` / `--pencil` | `--faded` / `--pencil` | ANSI black repurposed as ink-weight steps, not literal black |
| `white` / `brightWhite` | `--ink` / `--bright` | `--ink` / `--bright` | |
| `red` / `brightRed` | `--bad` (muted, non-bright use) | `--bad` | **only** if the pty genuinely emits ANSI red for a destructive/fatal signal; otherwise remap to `--faded` so ordinary CLI red-text (e.g. a linter's non-fatal warning) doesn't read as alarm |
| `green` / `brightGreen` | `--conf` | `--conf` | reuse verdigris ONLY if the semantic is genuinely "confirmed/success," else remap to `--ink` |
| `yellow` / `brightYellow` | `--sugg` | `--sugg` | reuse pencil-amber ONLY if genuinely "suggested/pending," else `--pencil` |
| `blue`/`magenta`/`cyan` + bright variants | `--pencil` / `--faded` alternating | same | these have no semantic meaning in the identity system — keep them as ink-weight neutrals, resist the urge to assign real hues here just because ANSI expects 8 colours |
| `scrollbarSliderBackground` | `--rule` @ ~20% | `--hair` @ ~20% | xterm default is "foreground at 20% opacity" — swap foreground for `--rule` |
| `scrollbarSliderHoverBackground` | `--shade` | `--shade` | |
| `scrollbarSliderActiveBackground` | `--ink` @ 40% | `--ink` @ 40% | |

**The hard call:** raw ANSI green/red from arbitrary shell output (npm test failures, git diff,
grep -c) is going to fight law 1 constantly, because tools outside our control paint their own red
and green. Two honest options, neither perfect: (a) let genuine ANSI colour through only inside the
raw pty stream area (a clearly-scoped "terminal" sub-region that's allowed to look like a terminal),
while all *chrome around it* (block header, status glyph, session list) stays strictly monochrome
per law 1 — this is the recommended default; or (b) remap ANSI red/green to ink-weight everywhere,
which is truer to the letter of law 1 but will make `npm test` output visibly harder to scan and
may need a documented amendment. Recommend (a) and flag it for the identity owner: law 1 says
"chrome is monochrome," and raw shell output streamed through is arguably content, not chrome — same
category exception the doc already grants to serif email content vs sans chrome (law 2).

## Genericness failures to avoid

- **Black rectangle in a card.** A `<pre>`/xterm mount dropped into a `--leaf` card with no
  internal padding treatment is the single most common "looks like every other AI-coding-tool
  session viewer" tell. Fix: pattern 7 (block-level padding/line-height) plus theming `background`
  to `--bright`, not literal black — the terminal must read as *part of the paper*, not a punched-
  out hole in it.
- **Alarm-red exit codes / green "done" banners.** Directly violates law 1. Fix: pattern 5 (glyph +
  ink weight) and the ANSI-remap table above.
- **Endless undifferentiated scrollback.** Fix: pattern 1 (blocks) + pattern 9 (jump-to-now pill).
- **Sidebar session list with no state signal until you click in.** Forces N clicks to find the
  session that needs attention. Fix: pattern 5's glyph on the list row itself, pattern 3's filter.
- **Multi-pane grid as the default layout.** Reads as a NOC dashboard, not a focused work surface,
  and fights "minimize clicks" by splitting attention. Fix: pattern 8.
- **Colour-coded ANSI 16-colour palette left at library defaults.** Ships literal red/green/yellow
  straight from xterm.js's stock theme, silently reintroducing the hue system law 1 explicitly
  forbids. Fix: the theme-mapping table above must be applied, not skipped as "just terminal
  colours, doesn't count."
- **Serif leaking into terminal chrome, or terminal output leaking into serif.** Law 2 is
  content-vs-chrome, not "monospace is fine everywhere." Session labels, status text, and the block
  header (command line) are chrome → sans. Only literal command/output text is monospace; if a
  future feature surfaces cited email content inside a session block, that specific span should
  still get serif treatment per law 2, not monospace-by-inheritance.

## Sources
- [Terminal Blocks overview — Warp Docs](https://docs.warp.dev/terminal/blocks/)
- [Terminal Block Basics — Warp Docs](https://docs.warp.dev/terminal/blocks/block-basics/)
- [Blocks Behavior — Warp Docs](https://docs.warp.dev/terminal/appearance/blocks-behavior/)
- [ITheme — xterm.js API](https://xtermjs.org/docs/api/terminal/interfaces/itheme/)
- [ITerminalOptions — xterm.js API](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)
- [sesh: Smart tmux session manager](https://github.com/joshmedeski/sesh)
- [tmux-sessionx: session manager with preview + fuzzy finding](https://github.com/omerxx/tmux-sessionx)
- [Ghostty terminal — victor.kropp.name](https://victor.kropp.name/blog/2025/ghostty/)
- [Ghostty Option Reference](https://ghostty.org/docs/config/reference)
- [VS Code Terminal Basics](https://code.visualstudio.com/docs/terminal/basics)
- [Show an indicator if a terminal task tab is "running" — vscode#121659](https://github.com/microsoft/vscode/issues/121659)
- [Terminal UI: No Scrollback, Limited Response Visibility — claude-code#7389](https://github.com/anthropics/claude-code/issues/7389)
- [Red in UI Design: Best Practices, Common Mistakes](https://medium.com/design-bootcamp/red-in-ui-design-guidelines-limits-and-smart-ux-decisions-0dd94cf2667d)
