# Deferred Items — Phase 29

## 29-02: Pre-existing test-isolation flake in test_genui_retrieval_provider.py
- **Found during:** Task 3 full-suite verification run
- **Symptom:** All 24 `TestLexicalRetrievalProviderBehavior` tests fail when the full `tests/` suite
  runs together, but pass 24/24 when run in isolation or with only the new `test_knowledge_graph_repository.py`
  excluded. Confirmed unrelated to this plan's files (`git stash` of tracked changes did not fix it;
  reproduces on unmodified `main`).
- **Likely cause:** shared/global state pollution from another test module (test ordering dependency),
  not touched by 29-02's scope.
- **Action:** out of scope for 29-02 (SCOPE BOUNDARY rule) — not fixed. Left for a future test-hygiene pass.
