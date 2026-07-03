# Milestones

## v1.2 Generative UI: Realism & Interactivity (Shipped: 2026-07-03)

**Phases completed:** 5 phases, 14 plans, 17 tasks

**Delivered:** the generative-UI engine grew from a reliable declarative catalog into a hybrid that
can produce *any* design — a jailed-eval sandboxed code-island — grounded by design-token style packs,
richer components, a zero-eval form engine, and an eval-driven studio.

**Key accomplishments:**

- **Phase 16 — Studio foundation (eval-driven):** eval harness + LLM-judge UI-quality rubric, plus History and Page-Ideas studio tabs.
- **Phase 17 — Tier A grounding:** 6 WCAG-AA W3C-DTCG design-token "style packs" + ThemedRoot CSS-var wrapper + assembly RAG (retrieval-before-generation).
- **Phase 18 — Catalog expansion:** real domain components (avatar / input / nav / feed-item / tabs / section) with a standing wire↔render parity gate.
- **Phase 19 — Declarative form engine:** a zero-eval `form` node (AJV rejected — it compiles via `new Function`; bounded custom validator instead), declarative conditional logic, and SEAM-02 submit.
- **Phase 20/21 — Sandboxed code-island (jailed-eval, USER SIGN-OFF):** iframe opaque-origin jail + inline-CSP + host-side AST allowlist + v0-style validate→autofix→run→heal→fallback loop; live Bedrock code generation **verified working**; parallel multi-candidate + LLM judge for quality.
- **Cost/safety:** $30/month AWS budget alert; conservative multi-candidate defaults (2 + Haiku judge); generation is manual-click only (idle spend = $0).

**Known deferred items at close:** 15 (see STATE.md → Deferred Items) — all connected-env / browser
verifications (human-UAT + eval-lift-vs-baseline measurements needing live Bedrock). Audit status:
`tech_debt`, 0 gaps (see milestones/v1.2-MILESTONE-AUDIT.md).

---
