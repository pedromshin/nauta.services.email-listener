# Phase 9: Entity/Field Region-Relationship Model + Canvas Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 09-entity-field-region-relationships-canvas
**Areas discussed:** Role & relationship control, Sub-field autofill behavior, Relationship persistence, Canvas redesign scope (+ Deny behavior)

---

## Role & relationship control

### Q: Where to set a region's role + relationships?
| Option | Description | Selected |
|--------|-------------|----------|
| Right inspector panel | Figma-style properties panel; Role selector → entity-type or parent+property pickers | ✓ |
| Context menu on the box | Right-click → Make Entity / Make Field of… / Mark Unrelated | |
| Inline in the regions list | Dropdowns per row (the cramped pattern being replaced) | |

### Q: Canvas default visibility (anti-bloat)?
| Option | Description | Selected |
|--------|-------------|----------|
| Entities first, fields on select | Show entities; selecting one reveals its fields; unrelated behind a toggle | ✓ |
| All boxes, color-coded | Always render everything in distinct colors | |
| Entities + their fields always | Hide only unrelated | |

**Locked without asking (verbatim user request):** active-parent model (select entity → next boxes become its fields; no entity selected → standalone); manual override always wins over AI.

---

## Sub-field autofill behavior

### Q: What does Autofill do with smaller boxes inside the selected entity?
| Option | Description | Selected |
|--------|-------------|----------|
| Detect, create & fill | LLM scans entity bbox, creates token-grounded field boxes, maps each to property+value; also picks up user-drawn boxes | ✓ |
| Fill only my boxes | Only acts on boxes the user drew | |
| Both, your choice | Two separate actions | |

### Q: What state do autofilled values land in?
| Option | Description | Selected |
|--------|-------------|----------|
| Candidates for review | Per-field confidence; confirm/correct; feeds flywheel | ✓ |
| Auto-confirm high, review low | Threshold-based auto-confirm | |
| All candidates, bulk confirm | Candidates + a Confirm-all button | |

---

## Relationship persistence

### Q: How to store role + field→property link durably?
| Option | Description | Selected |
|--------|-------------|----------|
| First-class columns + migration | `role` enum + `entity_type_id` on entities + `parent_component_id` for field→entity | ✓ |
| jsonb in content_raw | Store in existing jsonb, no migration | |
| Hybrid: role column, rest jsonb | Only `role` is a column | |

### Q: How does a FIELD record WHICH property it maps to?
| Option | Description | Selected |
|--------|-------------|----------|
| FK to entity_type_fields | `entity_type_field_id` FK → entity_type_fields.id | ✓ |
| Plain field_slug string | Slug string, no FK | |
| You decide | Planner picks safest | |

---

## Canvas redesign scope

### Q: How far should the redesign go?
| Option | Description | Selected |
|--------|-------------|----------|
| Full editor shell | Toolbar + left layers tree + canvas + right inspector | ✓ |
| Incremental reorg | Restyle/rearrange current panes | |
| You decide / planner scopes | Planner picks the cut | |

### Q: Drawing interaction model?
| Option | Description | Selected |
|--------|-------------|----------|
| Always-draw, click-selects | Drag empty = draw; click = select | (basis) |
| Explicit tool toggle | Figma V/R tools | |
| Draw tool + quick key | Hybrid | |

**User's free-text choice:** "least friction but also think about whole user navigability, zooming in and out, dragging, selecting, drawing rectangles." → Resolved (user confirmed "ok") to: **drag-on-empty = draw (default, zero-friction); pan = Space-drag / scroll; zoom = Cmd/Ctrl+scroll + toolbar Fit controls; click = select, Shift-click = multi-select; move/resize = Phase 6 redraw/supersede; optional Select/Move⟷Draw toggle in toolbar.**

---

## Deny behavior (user explicitly requested discussion)

### Q: What does ✗ (deny) do to a candidate field box?
| Option | Description | Selected |
|--------|-------------|----------|
| Origin-aware (smart) | ✗ on auto-detected box → soft-reject/remove; ✗ on user-drawn box → keep box, clear value | ✓ |
| Uniform reject | ✗ always rejects box + value | |
| Value-only deny | ✗ only clears value, never removes a box | |

### Q: Remember denials so re-runs don't re-propose the same box?
| Option | Description | Selected |
|--------|-------------|----------|
| Remember denials | Don't resurface a rejected auto-detected box on re-run | ✓ |
| Stateless | Re-run may re-propose | |

**Notes:** Inline ✓/✗ controls sit on each box for "click-click-click" review; inspector is for corrections only.

---

## Claude's Discretion

- Migration column nullability/defaults; whether to promote `parent_component_id` to a declared FK.
- Sub-field autofill LLM call structure (one-call-per-entity vs per-box).
- Mechanism for "remember denials" (rejected status + content_raw lineage vs dedicated structure).
- Toolbar iconography, keybindings, zoom limits, layers-tree affordances, optimistic-update strategy.
- Optional entity-level "Confirm all" + per-entity completion state.

## Deferred Ideas

- Entity-instance matching (nauta_id); multi-page entity spanning; bulk/cross-entity autofill;
  undo/redo; realtime multi-user; negative few-shot learning from denials; non-rectangular polygons.
