# Phase 6: Region Edit Operations — Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/email-listener/app/application/use_cases/edit_region.py` (per-op modules) | service | CRUD + transform | `app/application/use_cases/confirm_region.py` | exact |
| `apps/email-listener/app/presentation/api/v1/components.py` (extend) | controller | request-response | existing `components.py` (autofill/confirm) | exact |
| `apps/email-listener/app/domain/ports/component_repository.py` (extend) | model/port | CRUD | existing port file | exact |
| `apps/email-listener/app/infrastructure/supabase/component_repository.py` (extend) | service | CRUD | existing `SupabaseComponentRepository` | exact |
| `apps/email-listener/tests/test_edit_region*.py` | test | request-response | `tests/test_confirm_region.py` | exact |
| `packages/api-client/src/geometry.ts` (extend) | utility | transform | existing `geometry.ts` | exact |
| `packages/api-client/src/geometry.test.ts` (extend) | test | transform | existing `geometry.test.ts` | exact |
| `packages/api-client/src/router/emails/mutations.ts` (new) | service | request-response | `router/emails/detail.ts` + `router/emails/index.ts` | role-match |
| `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` | component | event-driven | `region-overlay-box.tsx` + `pdf-preview-pane.tsx` toolbar | role-match |
| `apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx` | component | event-driven | `pdf-preview-pane.tsx` toolbar row | role-match |
| `apps/web/src/app/emails/[id]/_components/draw-overlay.tsx` | component | event-driven | `overlay-layer.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` | component | event-driven | `packages/ui/src/popover.tsx` | partial |
| `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx` | component | event-driven | `packages/ui/src/alert-dialog.tsx` | partial |
| `apps/web/src/app/layout.tsx` (add Toaster) | config | — | existing `layout.tsx` + `packages/ui/src/sonner.tsx` | exact |

---

## Pattern Assignments

### `app/application/use_cases/edit_region.py` (service, CRUD)

**Analog:** `apps/email-listener/app/application/use_cases/confirm_region.py`

**Module docstring + architecture contract** (lines 1–12):
```python
"""EditRegionUseCase — region edit operations (accept / reject / redraw / split / merge / nest).

Architecture contract: imports ONLY domain ports and entities.
No infrastructure imports permitted (verified by lint-imports rule).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
import structlog
from app.domain.entities.component import Component
from app.domain.ports.component_repository import ComponentRepository
```

**Class scaffold — keyword-only `__init__`, structlog binding** (lines 30–75 of `confirm_region.py`):
```python
logger = structlog.get_logger(__name__)

class AcceptRegionUseCase:
    def __init__(self, *, components: ComponentRepository) -> None:
        self._components = components

    async def execute(self, *, component_id: str) -> Component:
        log = logger.bind(component_id=component_id)
        log.info("accept_region_start")

        component = await self._components.find_by_id(component_id)
        if component is None:
            log.warning("accept_region_component_not_found")
            raise ValueError(f"Component not found: {component_id}")

        # D-18: derive tenant from component row itself
        # D-16: status-only transition — update in place via update_status()
        updated = await self._components.update_status(component_id, "candidate")
        log.info("accept_region_done")
        return updated
```

**Supersede pattern (redraw/split/merge) — frozen dataclass spread** (`confirm_region.py` lines 107–127):
```python
# Supersede: mark original(s) "superseded" then create new child Component
# (D-16: never mutate geometry — spread frozen dataclass to create new)
superseded = Component(
    id=component.id,
    email_id=component.email_id,
    importer_id=component.importer_id,
    attachment_id=component.attachment_id,
    parent_component_id=component.parent_component_id,
    source_type=component.source_type,
    location=component.location,
    content_text=component.content_text,
    content_markdown=component.content_markdown,
    content_raw={**(component.content_raw or {}), "lineage": {"superseded_by": new_id}},
    embedding=component.embedding,
    sequence_index=component.sequence_index,
    extraction_status="superseded",
)
await self._components.save_many([superseded])
```

**Token-capture pattern for human-drawn regions** (`propose_regions.py` `_page_tokens` + `_union_polygon`, lines 26–84):
```python
# Reuse _page_tokens() from propose_regions.py to get token list from page component
# Reuse _union_polygon() to compute bounding polygon from intersecting token bboxes
# For Phase 6: import these helpers and apply to page component when building new regions
from app.application.use_cases.propose_regions import _page_tokens, _union_polygon
```

**New child Component construction** (`propose_regions.py` lines 218–235):
```python
child = Component(
    id=str(uuid.uuid4()),
    email_id=page.email_id,
    importer_id=page.importer_id,
    attachment_id=page.attachment_id,
    parent_component_id=page.id,
    source_type="region",
    location={"page_index": page_index, "polygon": polygon},
    content_text=captured_text,
    content_markdown=None,
    content_raw={"lineage": {"origin": "human_redraw", "supersedes": original_id}},
    embedding=None,
    sequence_index=0,
    extraction_status="candidate",  # human regions born candidate (D-09)
)
```

---

### `app/presentation/api/v1/components.py` (extend, controller, request-response)

**Analog:** existing `apps/email-listener/app/presentation/api/v1/components.py`

**Router + auth setup** (lines 25–29):
```python
from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.presentation.api.response import ApiResponse
from app.presentation.middleware.auth import require_api_key

router = APIRouter(
    prefix="/v1/components",
    tags=["components"],
    dependencies=[Depends(require_api_key)],
)
```

**Pydantic request model pattern** (lines 32–47):
```python
class AcceptAck(BaseModel):
    component_id: str
    status: str = "candidate"

class RejectAck(BaseModel):
    component_id: str
    status: str = "rejected"

class RedrawRequest(BaseModel):
    polygon: list[list[float]]  # exactly 4 [x,y] pairs, each in [0,1]
    page_index: int

class SplitRequest(BaseModel):
    regions: list[RedrawRequest]  # >= 2 entries

class MergeRequest(BaseModel):
    component_ids: list[str]  # >= 2 ids
    polygon: list[list[float]] | None = None
    page_index: int | None = None

class NestRequest(BaseModel):
    parent_component_id: str | None
```

**Endpoint pattern — ValueError → 404, other → 500 via raise** (lines 51–105):
```python
@router.post("/{component_id}/accept")
@inject
async def accept_component(
    component_id: str,
    use_case: FromDishka[AcceptRegionUseCase],
) -> ApiResponse[AcceptAck]:
    try:
        result = await use_case.execute(component_id=component_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ApiResponse.ok(AcceptAck(component_id=result.id))
```

**D-18 tenancy note:** importer_id is derived from the component row inside the use case — never passed as a header from the caller. This is the same contract as confirm/autofill.

---

### `app/domain/ports/component_repository.py` (extend, model/port, CRUD)

**Analog:** existing `apps/email-listener/app/domain/ports/component_repository.py`

**Protocol method pattern** (lines 11–28):
```python
class ComponentRepository(Protocol):
    async def save_many(self, components: list[Component]) -> list[Component]: ...
    async def find_by_id(self, component_id: str) -> Component | None: ...
    async def find_by_email_id(self, email_id: str) -> list[Component]: ...
    async def update_embedding(self, component_id: str, embedding: tuple[float, ...]) -> None: ...

    # NEW for Phase 6 — add these:
    async def update_status(self, component_id: str, status: str) -> Component: ...
    async def update_parent(self, component_id: str, parent_id: str | None) -> Component: ...
    async def find_by_page_component_id(self, page_component_id: str) -> list[Component]: ...
```

---

### `app/infrastructure/supabase/component_repository.py` (extend, service, CRUD)

**Analog:** existing `apps/email-listener/app/infrastructure/supabase/component_repository.py`

**`_to_row` / `_from_row` helpers** (lines 13–53) — copy exactly, extend `_to_row` if new fields added.

**`update` pattern** (line 82–84):
```python
async def update_status(self, component_id: str, status: str) -> Component:
    result = (
        self._client.table("email_components")
        .update({"extraction_status": status})
        .eq("id", component_id)
        .execute()
    )
    return _from_row(cast("dict[str, Any]", result.data[0]))

async def update_parent(self, component_id: str, parent_id: str | None) -> Component:
    result = (
        self._client.table("email_components")
        .update({"parent_component_id": parent_id})
        .eq("id", component_id)
        .execute()
    )
    return _from_row(cast("dict[str, Any]", result.data[0]))
```

**`save_many` upsert** (line 66–70 — reused for supersede + create new in one call):
```python
async def save_many(self, components: list[Component]) -> list[Component]:
    payload = [_to_row(c) for c in components]
    result = self._client.table("email_components").upsert(payload, on_conflict="id").execute()
    return [_from_row(cast("dict[str, Any]", row)) for row in result.data]
```

---

### `apps/email-listener/tests/test_edit_region*.py` (test)

**Analog:** `apps/email-listener/tests/test_confirm_region.py`

**AsyncMock port + test structure** (lines 19–127):
```python
from __future__ import annotations
import asyncio
import os
from unittest.mock import AsyncMock
import pytest
from dishka import Provider, Scope, make_async_container
from fastapi.testclient import TestClient

from app.application.use_cases.edit_region import AcceptRegionUseCase
from app.domain.entities.component import Component
from app.main import create_app
from app.settings import get_settings

_COMP_ID = "comp-0000-0000-0000-0000-000000000001"
_IMPORTER_ID = "imp-0000-0000-0000-0000-000000000001"

def _make_component(extraction_status: str = "pending") -> Component:
    return Component(
        id=_COMP_ID,
        email_id="email-0001",
        importer_id=_IMPORTER_ID,
        attachment_id=None,
        parent_component_id=None,
        source_type="region",
        location={"page_index": 0, "polygon": [[0,0],[1,0],[1,1],[0,1]]},
        content_text="region text",
        content_markdown=None,
        content_raw=None,
        embedding=None,
        sequence_index=0,
        extraction_status=extraction_status,
    )

def test_accept_region_status_becomes_candidate() -> None:
    component = _make_component(extraction_status="pending")
    components = AsyncMock()
    components.find_by_id.return_value = component
    components.update_status.return_value = Component(**{**component.__dict__, "extraction_status": "candidate"})

    use_case = AcceptRegionUseCase(components=components)
    asyncio.run(use_case.execute(component_id=_COMP_ID))

    components.update_status.assert_called_once_with(_COMP_ID, "candidate")
```

**Dishka container override for endpoint tests** (lines 420–431):
```python
def _make_test_client(mock_use_case) -> TestClient:
    def provide_use_case():
        return mock_use_case

    provider = Provider(scope=Scope.APP)
    provider.provide(provide_use_case, provides=AcceptRegionUseCase)

    app = create_app()
    app.state.dishka_container = make_async_container(provider)
    return TestClient(app, raise_server_exceptions=False)
```

**API key test pattern** (lines 449–485 of `test_confirm_region.py`):
```python
def test_accept_endpoint_requires_api_key() -> None:
    old_key = os.environ.get("API_KEY")
    os.environ["API_KEY"] = "test-secret-key"
    get_settings.cache_clear()
    try:
        # ... build client, assert 401 without key, 200 with key
    finally:
        if old_key is None:
            os.environ.pop("API_KEY", None)
        else:
            os.environ["API_KEY"] = old_key
        get_settings.cache_clear()
```

---

### `packages/api-client/src/geometry.ts` (extend, utility, transform)

**Analog:** existing `packages/api-client/src/geometry.ts`

**Existing `polygonToRect` style** (lines 1–49) — copy the pure-function, immutable-return, JSDoc pattern. New helpers follow the same structure:

```typescript
/**
 * Geometry utilities for the PDF overlay layer.
 * All functions are pure (no side effects, immutable inputs/outputs).
 */

/** Clamps a value to [lo, hi]. */
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

// Existing polygonToRect unchanged.

/**
 * clientXYToNormalized: converts pointer event client coordinates to [0,1]
 * normalized coordinates relative to the overlay div's bounding rect.
 * Pure function — never mutates inputs.
 */
export function clientXYToNormalized(
  clientX: number,
  clientY: number,
  overlayBounds: DOMRect,
): readonly [number, number] {
  const x = clamp((clientX - overlayBounds.left) / overlayBounds.width, 0, 1);
  const y = clamp((clientY - overlayBounds.top) / overlayBounds.height, 0, 1);
  return [x, y] as const;
}

/**
 * normalizedRectToPolygon: converts top-left + bottom-right normalized coords
 * to the 4-corner polygon format the API expects (clockwise from top-left).
 */
export function normalizedRectToPolygon(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ReadonlyArray<readonly [number, number]> {
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const right = Math.max(x0, x1);
  const bottom = Math.max(y0, y1);
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ] as const;
}
```

---

### `packages/api-client/src/geometry.test.ts` (extend, test, transform)

**Analog:** existing `packages/api-client/src/geometry.test.ts`

**Test structure — `describe` / `it`, `roundRect` helper, `as const satisfies`** (lines 1–138):
```typescript
import { describe, expect, it } from "vitest";
import { clientXYToNormalized, normalizedRectToPolygon } from "./geometry";

describe("clientXYToNormalized", () => {
  it("returns [0,1] normalized coords for center of bounds", () => {
    const bounds = { left: 100, top: 200, width: 400, height: 300 } as DOMRect;
    const [x, y] = clientXYToNormalized(300, 350, bounds);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });

  it("clamps out-of-bounds coordinates to [0,1]", () => {
    const bounds = { left: 100, top: 200, width: 400, height: 300 } as DOMRect;
    const [x, y] = clientXYToNormalized(0, 0, bounds);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it("returns a new readonly tuple each call (immutable)", () => {
    const bounds = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
    const r1 = clientXYToNormalized(50, 50, bounds);
    const r2 = clientXYToNormalized(50, 50, bounds);
    expect(r1).not.toBe(r2);
  });
});

describe("normalizedRectToPolygon", () => {
  it("produces 4-corner polygon from two normalized points", () => {
    const poly = normalizedRectToPolygon(0.1, 0.2, 0.5, 0.6);
    expect(poly).toHaveLength(4);
    expect(poly[0]).toEqual([0.1, 0.2]);
  });

  it("handles reversed points (x1 < x0)", () => {
    const poly = normalizedRectToPolygon(0.5, 0.6, 0.1, 0.2);
    expect(poly[0]).toEqual([0.1, 0.2]);
    expect(poly[2]).toEqual([0.5, 0.6]);
  });
});
```

---

### `packages/api-client/src/router/emails/mutations.ts` (new, service, request-response)

**Analog:** `packages/api-client/src/router/emails/detail.ts` + `apps/web/src/app/api/attachments/[id]/route.ts`

**Procedure structure — `publicProcedure.input(z.object(...)).mutation(...)`** (`detail.ts` lines 34–44):
```typescript
import { z } from "zod";
import { publicProcedure } from "../../trpc";

// Server-side env guard (pattern from attachments/[id]/route.ts lines 29–39)
const EMAIL_LISTENER_URL = process.env.EMAIL_LISTENER_URL;
const EMAIL_LISTENER_API_KEY = process.env.EMAIL_LISTENER_API_KEY;

function getListenerConfig(): { url: string; apiKey: string } {
  if (!EMAIL_LISTENER_URL || !EMAIL_LISTENER_API_KEY) {
    throw new Error("EMAIL_LISTENER_URL or EMAIL_LISTENER_API_KEY is not configured");
  }
  return { url: EMAIL_LISTENER_URL, apiKey: EMAIL_LISTENER_API_KEY };
}

// Polygon schema — shared for redraw/split/merge/create
const polygonSchema = z
  .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
  .length(4);

export const componentMutationProcedures = {
  accept: publicProcedure
    .input(z.object({ componentId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(`${url}/v1/components/${input.componentId}/accept`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? "accept failed");
      }
      return res.json();
    }),

  redraw: publicProcedure
    .input(z.object({
      componentId: z.string().uuid(),
      polygon: polygonSchema,
      pageIndex: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(`${url}/v1/components/${input.componentId}/redraw`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ polygon: input.polygon, page_index: input.pageIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? "redraw failed");
      }
      return res.json();
    }),

  // ... reject / split / merge / nest / createRegion follow same shape
};
```

**Root router extension** (`root.ts` + `emails/index.ts` spread pattern):
```typescript
// In router/emails/index.ts — spread componentMutationProcedures into emailsRouter
import { componentMutationProcedures } from "./mutations";

export const emailsRouter = createTRPCRouter({
  ...emailDetailProcedures,
  ...componentMutationProcedures,
  list: publicProcedure...
  byId: publicProcedure...
});
```

---

### `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` (component, event-driven)

**Analog:** `pdf-preview-pane.tsx` toolbar div (lines 155–230) + `region-overlay-box.tsx`

**Toolbar layout pattern** (`pdf-preview-pane.tsx` lines 155–160):
```tsx
"use client";
import { Button } from "@nauta/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@nauta/ui/tooltip";

// Toolbar div pattern from pdf-preview-pane.tsx:
<div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 bg-card"
     role="toolbar"
     aria-label="Region actions">
  <Button variant="default" size="sm" aria-label="Accept region" aria-keyshortcuts="a"
          disabled={status !== "pending"} onClick={onAccept}>
    ✓ Accept Region
  </Button>
  <Button variant="destructive" size="sm" aria-label="Reject region" aria-keyshortcuts="Delete"
          disabled={status === "rejected" || status === "superseded"} onClick={onReject}>
    ✗ Reject Region
  </Button>
  {/* ... outline buttons for Redraw / Split / Merge / Nest */}
</div>
```

**Conditional rendering pattern — CSS `hidden` not unmount** (`pdf-preview-pane.tsx` line 254):
```tsx
<div style={{ display: selectedComponentId !== null ? undefined : "none" }}>
  <ActionToolbar ... />
</div>
```

**Named export only:**
```tsx
export function ActionToolbar({ selectedComponentIds, components, onAccept, onReject, ... }: ActionToolbarProps) {
```

---

### `apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx` (component, event-driven)

**Analog:** `pdf-preview-pane.tsx` toolbar row pattern (lines 155–230)

```tsx
"use client";
import { Button } from "@nauta/ui/button";

interface DrawModeBarProps {
  mode: "redraw" | "split" | "add";
  drawnCount: number;
  onCancel: () => void;
  onConfirmSplit?: () => void;
}

export function DrawModeBar({ mode, drawnCount, onCancel, onConfirmSplit }: DrawModeBarProps) {
  const heading = mode === "redraw" ? "Draw Mode: Redraw"
    : mode === "split" ? "Draw Mode: Split"
    : "Draw Mode: Add Region";

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 bg-muted text-sm"
         role="status" aria-live="polite">
      <span className="text-sm font-semibold">{heading}</span>
      {/* instructions ... */}
      {mode === "split" && drawnCount >= 1 && (
        <Button variant="default" size="sm"
                disabled={drawnCount < 2}
                onClick={onConfirmSplit}>
          Confirm split ({drawnCount})
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel Draw (Esc)
      </Button>
    </div>
  );
}
```

---

### `apps/web/src/app/emails/[id]/_components/draw-overlay.tsx` (component, event-driven)

**Analog:** `overlay-layer.tsx` (absolute div + pointer-events pattern, lines 55–91)

**Pointer event container + live preview** (`overlay-layer.tsx` lines 55–79):
```tsx
"use client";
import { useRef } from "react";
import { clientXYToNormalized, normalizedRectToPolygon } from "@nauta/api-client/geometry";

interface DrawOverlayProps {
  pageSize: { width: number; height: number };
  onRectDrawn: (polygon: ReadonlyArray<readonly [number, number]>) => void;
  onCancel: () => void;
}

export function DrawOverlay({ pageSize, onRectDrawn, onCancel }: DrawOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // liveRect state for in-progress drag preview

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair"
      style={{ width: pageSize.width, height: pageSize.height }}
      role="application"
      aria-label="Drawing canvas"
      aria-description="Draw a rectangle. Press Escape to cancel."
      onPointerDown={(e) => {
        const bounds = overlayRef.current!.getBoundingClientRect();
        const [x, y] = clientXYToNormalized(e.clientX, e.clientY, bounds);
        // record start point
      }}
      onPointerMove={(e) => { /* update liveRect */ }}
      onPointerUp={(e) => {
        const bounds = overlayRef.current!.getBoundingClientRect();
        const [x1, y1] = clientXYToNormalized(e.clientX, e.clientY, bounds);
        // finalize + call onRectDrawn if size >= min
      }}
    >
      {/* Live preview rect — aria-hidden */}
      {liveRect && (
        <div
          aria-hidden="true"
          className="absolute border-2 border-primary border-dashed bg-primary/15"
          style={{
            left: liveRect.x0 * pageSize.width,
            top: liveRect.y0 * pageSize.height,
            width: (liveRect.x1 - liveRect.x0) * pageSize.width,
            height: (liveRect.y1 - liveRect.y0) * pageSize.height,
          }}
        />
      )}
    </div>
  );
}
```

**Key point:** `overlay-layer.tsx` has `pointer-events-none` class; `draw-overlay.tsx` must NOT have this — pointer events must reach it.

---

### `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` (component, event-driven)

**Analog:** `packages/ui/src/popover.tsx` (Radix Popover usage)

```tsx
"use client";
import { Popover, PopoverContent, PopoverTrigger } from "@nauta/ui/popover";
import { Button } from "@nauta/ui/button";

export function NestPicker({ component, eligibleRegions, open, onOpenChange, onNest, onUnNest }: NestPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Nest into parent region"
                aria-expanded={open}>
          ⤵ Nest into…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" aria-label="Select parent region">
        <p className="text-sm font-semibold pb-2">Nest into parent region</p>
        <div className="divide-y">
          {eligibleRegions.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No other regions on this page to nest into.
            </p>
          )}
          {eligibleRegions.map((r) => (
            <Button key={r.id} variant="ghost" size="sm"
                    className="w-full justify-start"
                    onClick={() => onNest(r.id)}>
              {r.entityTypeLabel ?? r.extractionStatus}
            </Button>
          ))}
          {component.parentComponentId && (
            <Button variant="ghost" size="sm"
                    className="text-muted-foreground w-full justify-start"
                    onClick={onUnNest}>
              Remove parent (un-nest)
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

### `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx` (component, event-driven)

**Analog:** `packages/ui/src/alert-dialog.tsx` (Radix AlertDialog — full component available)

**AlertDialog controlled-open + destructive action pattern** (`alert-dialog.tsx` lines 101–141):
```tsx
"use client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@nauta/ui/alert-dialog";
import { buttonVariants } from "@nauta/ui/button";

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RejectDialog({ open, onOpenChange, onConfirm }: RejectDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this region?</AlertDialogTitle>
          <AlertDialogDescription>
            The region will be marked as rejected and hidden from the default view.
            You can show it again using the &apos;Show history&apos; toggle.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            Reject region
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

### `apps/web/src/app/layout.tsx` (add Toaster, config)

**Analog:** existing `layout.tsx` (lines 1–23) + `packages/ui/src/sonner.tsx`

**Current layout — no Toaster present** (lines 1–23):
```tsx
import type { Metadata } from "next";
import { TRPCReactProvider } from "~/trpc/react";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
```

**Add Toaster inside `<body>` after the provider** — Toaster is a client component from `@nauta/ui/sonner`:
```tsx
import { Toaster } from "@nauta/ui/sonner";

// In <body>:
<TRPCReactProvider>{children}</TRPCReactProvider>
<Toaster />
```

**`Toaster` component** (`packages/ui/src/sonner.tsx` lines 1–31) — wraps `sonner`'s `<Sonner>` with the project theme. Already wired with `next-themes`. No configuration needed beyond the import.

**`toast` usage in mutation callbacks** (from `sonner` directly — NOT from `@nauta/ui`):
```tsx
import { toast } from "sonner";

// In mutation onSuccess:
toast.success("Region accepted");

// In mutation onError:
toast.error("Could not accept region. Try again.");
```

---

### `apps/web/src/app/emails/[id]/_components/email-detail.tsx` (modify, component, event-driven)

**Analog:** itself — `email-detail.tsx` lines 57–273

**State hoisting pattern** (lines 63–78 — add new state variables here):
```tsx
// Existing state:
const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
const [currentPage, setCurrentPage] = useState<number>(1);

// Add for Phase 6:
const [selectedComponentIds, setSelectedComponentIds] = useState<readonly string[]>([]);
const [drawMode, setDrawMode] = useState<"redraw" | "split" | "add" | null>(null);
const [drawnRects, setDrawnRects] = useState<ReadonlyArray<ReadonlyArray<readonly [number, number]>>>([]);
const [liveRect, setLiveRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
const [showHistory, setShowHistory] = useState<boolean>(false);
const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
const [nestPickerOpen, setNestPickerOpen] = useState<boolean>(false);
```

**tRPC utils for optimistic + invalidate** (`detail.ts` procedure name `emails.detail`):
```tsx
const utils = api.useUtils();

// Optimistic on mutation start:
utils.emails.detail.setData({ id: emailId }, (prev) => {
  if (!prev) return prev;
  return {
    ...prev,
    components: prev.components.map((c) =>
      c.id === componentId ? { ...c, extractionStatus: "candidate" } : c,
    ),
  };
});

// On success: invalidate to get fresh server data
await utils.emails.detail.invalidate({ id: emailId });
```

---

### `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` (modify, component, event-driven)

**Analog:** itself — lines 55–91

**Filter extension for Phase 6** — add `showHistory` prop and filter `rejected`/`superseded` by default:
```tsx
// Current filter (line 66):
const overlays = components.filter((c) => {
  if (c.sourceType !== "region") return false;
  if (!hasPolygon(c.location)) return false;
  const pageIndex = getPageIndex(c.location);
  return pageIndex === currentPage - 1;
});

// Phase 6 extension:
const overlays = components.filter((c) => {
  if (c.sourceType !== "region") return false;
  if (!hasPolygon(c.location)) return false;
  const pageIndex = getPageIndex(c.location);
  if (pageIndex !== currentPage - 1) return false;
  // history gate — hide rejected/superseded unless showHistory is on
  if (!showHistory && (c.extractionStatus === "rejected" || c.extractionStatus === "superseded")) {
    return false;
  }
  return true;
});
```

---

### `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` (modify, component, event-driven)

**Analog:** itself — lines 80–143

**Click-to-select extension** (add `onClick` + `selectedComponentId` props, building on existing `onMouseEnter`/`onFocus` pattern lines 124–128):
```tsx
// Existing hover pattern:
onMouseEnter={() => setActiveComponentId(component.id)}
onMouseLeave={() => setActiveComponentId(null)}

// Phase 6 — add click-to-select:
onClick={(e) => {
  e.stopPropagation();
  if (e.shiftKey) {
    // multi-select toggle
    onShiftClick?.(component.id);
  } else {
    onSelectComponent?.(component.id);
  }
}}
```

**Status-differentiated border classes** (building on existing `activeClasses` lines 93–97):
```tsx
const statusClasses =
  component.extractionStatus === "pending"
    ? "border-primary/50 border-dashed bg-primary/8"
    : component.extractionStatus === "rejected" || component.extractionStatus === "superseded"
    ? "border-border/40 border-dashed bg-muted/50 opacity-40"
    : "border-primary/80 bg-primary/10";  // candidate

const selectedClass = isSelected ? " ring-2 ring-primary/50 bg-primary/25" : "";
const mutatingClass = isMutating ? " border-primary/40 animate-pulse" : "";
```

---

## Shared Patterns

### Authentication (X-API-Key)

**Source:** `apps/email-listener/app/presentation/middleware/auth.py`
**Apply to:** All new FastAPI endpoint functions in `components.py`
```python
router = APIRouter(
    prefix="/v1/components",
    tags=["components"],
    dependencies=[Depends(require_api_key)],  # applied at router level, not per-handler
)
```

### API Response Envelope

**Source:** `apps/email-listener/app/presentation/api/response.py`
**Apply to:** All new FastAPI endpoints
```python
from app.presentation.api.response import ApiResponse

# Success: return ApiResponse.ok(MyViewModel(...))
# Error: raise HTTPException(status_code=404, detail=str(exc)) — never return ApiResponse.fail()
```

### D-18 Tenancy (importer_id from component row)

**Source:** `apps/email-listener/app/application/use_cases/confirm_region.py` lines 83–89
**Apply to:** All new use cases that touch component rows
```python
# D-18: derive tenant from the component itself; explicit mismatch 404s
if importer_id is not None and component.importer_id != importer_id:
    raise ValueError(f"Component not found: {component_id}")
importer_id = component.importer_id
```

### DI Container Registration

**Source:** `apps/email-listener/app/container.py` lines 223–274
**Apply to:** All new use cases
```python
# In _build_provider():
provider.provide(AcceptRegionUseCase)
provider.provide(RejectRegionUseCase)
provider.provide(RedrawRegionUseCase)
# etc.
# Use factory function when use case has ports with non-auto-injectable signatures
```

### structlog Binding

**Source:** `apps/email-listener/app/application/use_cases/confirm_region.py` lines 27, 75–79
**Apply to:** All new Python use cases
```python
logger = structlog.get_logger(__name__)

async def execute(self, *, component_id: str, ...) -> ...:
    log = logger.bind(component_id=component_id)
    log.info("operation_start")
    # ...
    log.info("operation_done")
```

### Server-side Env Guard for Secrets

**Source:** `apps/web/src/app/api/attachments/[id]/route.ts` lines 29–39
**Apply to:** `packages/api-client/src/router/emails/mutations.ts`
```typescript
// At module scope — checked at call time, not module init, so Next.js build doesn't fail
function getListenerConfig(): { url: string; apiKey: string } {
  const url = process.env.EMAIL_LISTENER_URL;
  const apiKey = process.env.EMAIL_LISTENER_API_KEY;
  if (!url || !apiKey) {
    throw new Error("EMAIL_LISTENER_URL or EMAIL_LISTENER_API_KEY is not configured");
  }
  return { url, apiKey };
}
```

### Immutable State Updates (tRPC optimistic)

**Source:** `email-detail.tsx` lines 99–104 (`setSignedUrls` spread pattern)
**Apply to:** All `utils.emails.detail.setData(...)` optimistic update calls
```tsx
utils.emails.detail.setData({ id: emailId }, (prev) => {
  if (!prev) return prev;
  return {
    ...prev,
    components: prev.components.map((c) =>
      c.id === targetId ? { ...c, extractionStatus: newStatus } : c,
    ),
  };
});
```

### Frozen Dataclass Spread (Python immutable entity update)

**Source:** `apps/email-listener/app/application/use_cases/confirm_region.py` lines 112–127
**Apply to:** All use cases that need to create a modified copy of a `Component` entity
```python
# Component is @dataclass(frozen=True) — use dataclasses.replace() or spread via constructor
import dataclasses

superseded = dataclasses.replace(component, extraction_status="superseded",
    content_raw={**(component.content_raw or {}), "lineage": {...}})
```

---

## No Analog Found

All files have close matches. No entries in this section.

---

## Metadata

**Analog search scope:** `apps/email-listener/`, `packages/api-client/src/`, `apps/web/src/app/`, `packages/ui/src/`
**Files scanned:** 22
**Pattern extraction date:** 2026-06-12
