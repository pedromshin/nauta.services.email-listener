---
status: partial
phase: 23-2d-canvas-panels-as-nodes-shared-state
source: [23-VERIFICATION.md]
started: 2026-07-05T02:20:00Z
updated: 2026-07-05T02:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag/pan/zoom responsiveness
expected: Smooth drag/pan/zoom of genui-panel nodes and the chat node with no visible jank; dragging never triggers a panel-body re-render (bodies are memoized on stable props — perceived smoothness needs a live check)
result: [pending]

### 2. Live Bedrock streaming on the Canvas view
expected: First-time turn — live text/partial content visible in the ChatNode's embedded MessageList; new genui-panel fades in once the turn settles with no relayout of existing panels. Regenerate — existing panel's content updates live via the streamingByProvenance overlay without the nodes array changing identity
result: [pending]

### 3. Drag-to-connect + edge edit (EdgeCreationPicker)
expected: Popover opens anchored at the drop point / label pill; "Connect fields" only commits on confirm; "Don't connect" and Escape create nothing. With the 23-06 write path wired, clicking a genui-spec setState button first populates the store, so the Source-field Select shows at least one real option — no manual store-seeding needed
result: [pending]

### 4. Visual fidelity vs 23-UI-SPEC.md
expected: unknown-node-type-placeholder, view toggle, and keyboard-hint banners match the UI-SPEC's exact copy and Tailwind token usage (font weights, muted/destructive tokens, icon choices)
result: [pending]

### 5. Live-browser confirmation of click → store → edge chain
expected: Identical to the passing unmocked jsdom test (panel-data-flow.test.tsx) — store write, non-empty field options, live edge resolution — confirmed once in a real browser against the real chat backend
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
