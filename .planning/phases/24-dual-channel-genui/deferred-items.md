# Deferred Items — Phase 24 (Dual-Channel GenUI)

Out-of-scope discoveries logged during execution (not fixed — pre-existing, unrelated to the
task in progress when found).

## 24-02

- **Pre-existing mypy errors in `supabase_chat_widget_interaction_repository.py::is_stale`**
  (line ~149, 6x `union-attr` on `message_rows[0].get(...)` — postgrest-py's `APIResponse.data`
  item type is a recursive `JSON` union mypy can't narrow without an escape hatch). Confirmed
  present in the original 24-01 commit (`git show HEAD:...` reproduces identically) — not
  introduced or touched by 24-02's additive `interaction_id` param change to `create_pending`.
  Same class of gap 24-01-SUMMARY.md already noted as accepted elsewhere in this codebase
  (e.g. `genui_generator_adapter.py`). Left as-is (out of scope for 24-02).
