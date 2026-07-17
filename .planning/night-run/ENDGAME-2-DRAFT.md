# Endgame 2 — DRAFT ladder beyond v1.10 (2026-07-16)

**Status: DRAFT.** Derived from the user's 2026-07-16 brief (verbatim in the night-strategy-sweep
derive prompt) + the locked two-epoch endgame (ENDGAME-PLAN.md). To be reconciled with
`night-run/reports/negative-space.md` and the E4–E7 definitions in VISION.md when the sweep lands,
then folded into VISION.md/ENDGAME-PLAN.md as a provenance-marked revision. This draft does NOT
unlock any phase by itself — each milestone still opens through /gsd:new-milestone.

## Organizing principle

Every milestone ends with the user DELETING one tool from their life — a switch moment, not a
feature count. A milestone that retires nothing external is peripheral by definition (user's
point 11) and gets cut or demoted to backlog.

## The ladder

| Milestone | Ships | Switch moment (tool retired) | Gated by |
|---|---|---|---|
| v1.11 — Research & Documents Core | In-chat deep research (agentic, multi-step, cited), PDF/document generation, email automation rules fixture-first, tenancy ADRs (accommodate-only) | Claude web for research sessions | Nothing — fully autonomous |
| v1.12 — Live Loop & Money | Real inbound email live (LIVE-03/04 + CLUS-07 console debt), automation rules on real mail: recurring spam triage, financial extraction → sheets/documents, LEARN loop on real corrections | The weekly/monthly email→finance ritual; n8n/make pre-empted | USER console actions (~30 min) |
| v2.0 — Agent Platform | The existing E6/DMON plan, kept: daemon + ONE permission model + generalized ToolExecutor; watched folders → directory panels with attached chats; browser panel CDP-first; tool registry as per-user allowlist | Claude Cowork | v1.11 chat maturity |
| v2.1 — Self-Cloud | File vault on own storage; files/recipes/sheets as first-class knowledge/canvas nodes; watched-folder sync via daemon; documents surface hardened | OneDrive | v2.0 daemon |
| v2.2 — Develop From Anywhere | Web access to Claude Code sessions on the always-on PC (session/terminal streaming = the 20/80, cheap); repo/GitHub management surfaces. Luxury tier: full low-latency remote desktop (Sunshine/Moonlight/WebRTC class — frontier report owns the bet) | The physical desk as a prerequisite for advancing the project | v2.0 daemon; always-on PC |
| v2.3 — The Ontology | Registry/ontology of OSS repos, skills, plugins, integrations that agents discover → install → run autonomously; grows from v2.0's tool registry + the knowledge graph; needs the post-cutoff research practice (frontier report) | Manual tool-wiring work | v2.0 registry seam |
| v3.0 — Launch hardening | ONLY if going public: RLS everywhere, orgs/workspaces BUILT (per tonight's tenancy ADRs, additive by then), billing seam, full security review | — | A launch decision |

Cross-cutting, never a milestone: audio/images/multimodal (Bedrock bolt-ons to chat on real need —
backlog); model control (shipped); genui (shipped, ahead of parity target).

## Sequencing logic

1. **Dependency gates dominate pain ordering.** The user's most-painful-to-lose (dev-from-anywhere)
   rides on the most infrastructure, so it lands after the daemon rather than as a hollow shell.
   The wedge is research-chat: cheapest high-pain switch, fully autonomous to build.
2. **v2.0 survives the reframe.** The user's brief makes the daemon MORE central (automations from
   anywhere, self-cloud sync, remote dev all ride on it), not obsolete.
3. **Tenancy is a posture, not a milestone.** ADRs + cheap accommodations now (tonight's
   tenancy-arch report); building orgs/RLS/billing waits for a launch decision.
4. **Email value is user-gated, twice asked, still open.** v1.12 is the first milestone the user
   must personally unlock (console debt). Everything else routes around it.

## Reconciliation TODO (owner: the night-run orchestrator)

- [ ] Map this ladder onto VISION.md's E4–E7 as written; note what E7 (parked) was.
- [ ] Fold the frontier report's remote-desktop + ontology bets into v2.2/v2.3 rows.
- [ ] Register new backlog 999.x items for everything cross-cutting (audio/images, remote desktop
      luxury tier, research practice cadence).
- [ ] On v1.10 completion: propose this as ENDGAME-PLAN v2 via the normal milestone flow — the user
      blesses or amends it when back; it is a recommendation, not a lock.
