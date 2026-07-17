# Taste research — research-canvas & email-triage patterns

**Assigned name:** taste-research-email
**Governing constraint:** D-58-01 (`.planning/phases/58-visual-identity-sketch-pick-human-gate/58-IDENTITY.md`) is LOCKED. Palette (verdigris/pencil-amber/madder/ink on warm paper|graphite) and typography (chrome=sans, evidence=serif, tabular numerals) are **non-negotiable**. Everything below is mined for **layout, density, hierarchy, interaction** only — none of it should be read as a palette or type suggestion.

Directive: "minimize clicks … research patterns and references." Two surfaces, patterns ranked by click-impact.

---

## Surface A — research/report reading (Perplexity, Elicit, NotebookLM, iA/NYT editorial)

1. **Inline citation chip → hover popover → full source sidebar (3-tier progressive disclosure).** Perplexity/ChatGPT pattern: claim stays readable with a small `[n]` or superscript chip; hovering/tapping reveals a popover (title, snippet, favicon); a dedicated sources panel gives the full audit trail. *Why:* readers verify at three different commitment levels without ever leaving the sentence. *Click impact:* verifying one claim = 0 clicks (hover) or 1 click (popover); full audit is opt-in, not forced. Maps directly onto our provenance mark — the **solid/dashed underline IS the chip**; hovering it should surface the same popover-tier disclosure (source excerpt + confidence tier) before a click is needed.

2. **Confidence-per-claim badge (Consensus pattern).** A colored strength indicator ("strong support / mixed / weak") sits next to individual claims, not just at the document level. *Why:* trust decisions happen at claim granularity, not report granularity. *Click impact:* zero — read-time signal. This is exactly our tier ladder (confirmed=solid verdigris mark, suggested=dashed amber mark) — the reference confirms the pattern is proven, not that we need new mechanics.

3. **Live multi-step progress trace during generation, collapsible after completion (OpenAI Deep Research / ChatGPT Agent pattern).** While research runs, a sidebar streams each step taken ("searching X", "reading Y", "N sources found") with the ability to interrupt/redirect mid-run; once done, the trace collapses to a compact summary the user can expand. *Why:* multi-step latency (10s–10min) needs legibility or it reads as broken; showing the *process* builds trust in the *output*. *Click impact:* 0 clicks to watch, 1 click to expand/inspect after the fact, 1 click to interrupt. Directly applicable to any multi-step extraction/reasoning job in our product — collapse-after-done is the key detail most teardowns miss.
4. **Editorial measure discipline (iA Writer / NYT): 45–75 characters per line, tabular/consistent leading, generous paragraph spacing.** *Why:* our report body IS the user's material (their email content) rendered in serif — this is exactly the surface where editorial rhythm rules apply, more than chrome does. *Click impact:* indirect — reduces re-reading/scroll-hunting, which is a cost even if not a "click." Concretely: cap serif body columns, don't let evidence text run full-bleed edge-to-edge even in a wide panel.

5. **Source-quality visual hierarchy, not flat lists (Perplexity "Links audit").** Sources aren't a bare bullet list — favicon + title + one-line relevance snippet + domain, sometimes grouped by "primary" vs "supporting." *Why:* scanning a source list should let you triage trust before opening anything. *Click impact:* saves the click of opening low-value sources speculatively.

6. **Mid-stream refinement without restart (ChatGPT deep research, Feb 2026 update).** User can inject a follow-up/course-correction while the multi-step job is still running, rather than waiting for completion then re-prompting. *Why:* the cost of a wrong initial framing compounds over a long research run. *Click impact:* saves an entire re-run cycle (potentially many clicks + wait) for one inline correction.

7. **NotebookLM-style source-scoped grounding indicator.** Every generated statement is visually tied to *which of the user's own uploaded sources* it came from (not just the open web) — this is closer to our own-mail-as-evidence model than Perplexity is. *Why:* it's the closest existing product to "answers grounded only in material you gave it," which is our email corpus. Worth studying its citation-to-source-panel linking mechanics specifically, not just Perplexity's web-citation mechanics.

---

## Surface B — email triage, minimal clicks (Superhuman, HEY Screener, Gmail failures)

1. **Optimistic UI + single-keystroke terminal actions (Superhuman).** Archive/label/reply-later fires visually instantly (email vanishes, focus auto-advances to next) with the network call trailing behind; target ~50-100ms perceived latency. *Why:* removes the "did that work?" pause that turns 1 click into a mental checkpoint. *Click impact:* the single largest lever — every triage action becomes exactly 1 keypress with zero confirm/undo-toast blocking the next action (undo is available but never gates progress).

2. **One-decision-at-a-time linear queue, not a scrollable list (Superhuman's flow model).** Instead of scrolling and cherry-picking, the UI presents one item, forces a decision (archive/reply/snooze/later), and auto-advances — batch triage becomes a rhythm, not a search task. *Why:* eliminates the re-scanning/re-scrolling cost that dominates real triage time even more than the click itself. *Click impact:* removes the "find the next thing to act on" step entirely — that's often more clicks than the action.

3. **Screener: decide about the *sender*, not the *email* — one-time approve/deny that's remembered forever (HEY).** First message from an unknown sender is held; user taps allow/block once; every future message from that sender is auto-routed with zero further review. *Why:* this is the direct structural analog to our suggest-only rules stance — a rule proposal should default to "decide once, apply forever" rather than "review every instance." *Click impact:* converts N future decisions into 1 decision, which is the entire point of a rules system and the thing Gmail filters fail to deliver ergonomically.

4. **Screener keeps the reversal path visible and cheap (HEY "screened out" list).** Blocked/screened-out senders remain in a single browsable list where any decision can be flipped in one tap — it is not a one-way gate hidden in settings. *Why:* this is the answer to "how does suggest-only avoid a settings-page graveyard" — the review surface for *already-made* decisions must live one click from where new decisions get made, not three menus deep in Settings → Filters → Manage. Gmail's own filter UI fails exactly here: 70% of users in usability studies couldn't find where to create/manage a filter at all because it's buried outside the obvious inbox flow.

5. **Rule proposals surfaced in-context, not in a separate settings page (the core anti-graveyard move).** Gmail filters die because they're created in an abstract settings form disconnected from the moment you'd want one ("this sender is always noise" only occurs to you *while reading that sender's email*). A suggest-only rules review that lives as a persistent-but-collapsed strip inside triage itself (e.g., "3 pending rule suggestions" chip near the inbox, not a nav item) keeps the review cadence tied to actual triage sessions instead of requiring a deliberate "go manage my rules" trip. *Click impact:* removes the discovery/context-switch cost that is the #1 documented reason Gmail filters go unused — the click count on any single filter is low, the click cost of *remembering the feature exists* is what kills it.

6. **Apply-retroactively as an explicit, separate choice (Gmail's biggest surprise-failure).** Gmail's "also apply to matching conversations" checkbox is off by default and most users don't know it exists, so new filters silently look "broken" against existing mail. Any suggest-only rule surface should make retroactive application an explicit, visible toggle at accept-time (not a buried option), since users will otherwise assume "approve this rule" = "clean up everything already in my inbox that matches."

7. **Pre-sorted split queues by mode, not one undifferentiated inbox (Superhuman).** Distinct triage modes (e.g. "needs reply" vs "FYI" vs "later") let a user batch-process similar decisions back-to-back rather than context-switching per email. *Why:* decision-type consistency lowers per-item cognitive cost even when click count per item is unchanged. *Click impact:* not fewer clicks per email, but fewer *wasted* clicks from mis-triaging under context-switch fatigue — still nets out to fewer total actions across a session.

8. **Confirm dialogs reserved for genuinely irreversible actions only, everything else uses undo (Superhuman + general pattern).** This maps onto our own colour law almost exactly (madder = irreversible only). Approving/denying a sender or rule should never show a confirm modal — only true data-loss actions should, with a toast-based undo covering everything else. *Click impact:* removes 1 click (the confirm) from every reversible action across the whole product.

---

## Direct answer: how does a suggest-only rules review avoid the settings-page graveyard?

Synthesizing patterns 3, 4, 5, 6 above into one stance: don't build a "Rules" settings page as the primary surface at all. Model it as HEY's Screener, not Gmail's Filters —
- rule *proposals* surface inline, in-context, at the moment a pattern is detected during normal triage (not a nav destination the user must remember to visit);
- the decision is "yes/no, once, forever" per sender/pattern — never a form to fill out;
- already-decided rules stay one click away in a flat reversible list (Screener's "screened out" list), so review-of-past-decisions and creation-of-new-decisions live in the same surface, not two;
- retroactive scope is an explicit visible choice at accept-time, not a hidden checkbox;
- this keeps the "settings" page from ever being the *primary* place rules are made — it becomes an audit trail, which people tolerate having low traffic to, rather than a workflow, which people don't.

---

## Sources
- [AI citation and source UI design patterns for 2026 - AYDesign](https://www.aydesign.ai/blog/ai-citation-source-ui-patterns-2026)
- [Perplexity Platform Guide: Design for Citation-Forward Answers](https://www.unusual.ai/blog/perplexity-platform-guide-design-for-citation-forward-answers)
- [AI UX Patterns | Citations | ShapeofAI.com](https://www.shapeof.ai/patterns/citations)
- [How Perplexity Decides Which Sources to Cite](https://authoritytech.io/blog/how-perplexity-selects-sources-algorithm-2026)
- [Case Study: How Superhuman Engineered a Beloved Email Experience](https://zetetikos.substack.com/p/case-study-how-superhuman-engineered)
- [Superhuman: Speed as the Product](https://blakecrosley.com/guides/design/superhuman)
- [Design System Analysis: Superhuman](https://getdesign.md/superhuman/design-md)
- [The Screener - HEY](https://help.hey.com/article/722-the-screener)
- [What Is an Email Screener? (2026 Guide) - Leave Me Alone](https://leavemealone.com/blog/email-screener-approve-senders-2026/)
- [Gmail UX Case Study: A Redesign to Enhance Usability and Accessibility](https://medium.com/@flordaniele/gmail-ux-case-study-a-redesign-to-enhance-usability-and-accessibility-8a0c3f4ca53b)
- [Gmail Filters Not Working? How to Fix Them (2026)](https://www.getinboxzero.com/blog/post/gmail-filters-not-working-troubleshooting-guide)
- [Does Gmail filter emails? Here's what's going on | Fyxer](https://www.fyxer.com/blog/does-gmail-filter-emails)
- [Introducing deep research | OpenAI](https://openai.com/index/introducing-deep-research/)
- [ChatGPT and the new Tools interface](https://www.datastudios.org/post/chatgpt-and-the-new-tools-interface-six-modes-to-access-agent-research-study-and-creation)
- [Deep research in ChatGPT | OpenAI Help Center](https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt)
- [Editorial Typography | Typography Master](https://www.typographymaster.com/guide/editorial-typography)
- [Rhythm and Flow in Editorial Design | Fiveable](https://fiveable.me/advanced-editorial-design/unit-2/rhythm-flow-editorial-design/study-guide/RyqTytOWkCcd0y6x)
- [A new leaf: NYT Magazine redesign - It's Nice That](https://www.itsnicethat.com/features/gail-bichler-the-new-york-times-magazine-redesign-publication-spotlight-080426)
