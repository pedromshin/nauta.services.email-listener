# Phase 9: Entity-Field-Region Relationships Canvas — Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 38 new/modified files across 4 areas
**Analogs found:** 36 / 38

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/db/src/schema/enums.ts` (modify) | model | transform | self | exact |
| `packages/db/src/schema/components.ts` (modify) | model | CRUD | self | exact |
| `packages/db/src/migrations/XXXX_add_component_role.sql` | migration | CRUD | existing migrations | role-match |
| `apps/web/src/app/emails/[id]/_components/canvas-shell.tsx` | component | request-response | `pdf-preview-pane.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx` | component | event-driven | `action-toolbar.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/layers-panel.tsx` | component | request-response | `entities-list.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/layers-tree-row.tsx` | component | event-driven | `entities-list.tsx` (row section) | role-match |
| `apps/web/src/app/emails/[id]/_components/inspector-panel.tsx` | component | request-response | `entities-list.tsx` (fields section) | role-match |
| `apps/web/src/app/emails/[id]/_components/role-picker.tsx` | component | event-driven | `entity-type-picker.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/field-relationship-picker.tsx` | component | event-driven | `entity-type-picker.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/confirm-deny-controls.tsx` | component | event-driven | `draw-mode-bar.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/active-parent-banner.tsx` | component | event-driven | `draw-mode-bar.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` (modify) | component | event-driven | self | exact |
| `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` (modify) | component | event-driven | self | exact |
| `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` (modify) | component | event-driven | self | exact |
| `apps/web/src/app/emails/[id]/_components/use-canvas-state.ts` | hook | event-driven | `use-region-edit.ts` | exact |
| `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts` | hook | request-response | `use-region-edit.ts` | exact |
| `apps/web/src/app/emails/[id]/_components/use-autofill-fields.ts` | hook | event-driven | `use-autofill.ts` | exact |
| `packages/api-client/src/router/emails/mutations.ts` (modify) | service | request-response | self | exact |
| `packages/api-client/src/router/emails/detail.ts` (modify) | service | CRUD | self | exact |
| `packages/api-client/src/router/entity-types.ts` (modify) | service | CRUD | self | exact |
| `apps/email-listener/app/application/use_cases/autofill_fields.py` | service | request-response | `autofill.py` | exact |
| `apps/email-listener/app/presentation/api/v1/components.py` (modify) | controller | request-response | self | exact |
| `apps/web/src/app/layout.tsx` (modify) | config | request-response | self | exact |
| `packages/ui/src/sidebar.tsx` | component | event-driven | `resizable.tsx` | role-match |
| `apps/web/src/components/app-sidebar.tsx` | component | event-driven | `nest-picker.tsx` (popover pattern) | role-match |
| `apps/web/src/components/theme-provider.tsx` | provider | event-driven | none — shadcn boilerplate | no-analog |
| `apps/web/src/app/page.tsx` (modify) | component | CRUD | self | exact |
| `apps/web/src/app/_components/inbox-three-pane.tsx` | component | request-response | `apps/web/src/app/page.tsx` | role-match |
| `apps/web/src/app/_components/inbox-row.tsx` | component | request-response | `apps/web/src/app/page.tsx` (Card section) | role-match |
| `apps/web/src/app/_components/entity-chips.tsx` | component | request-response | `region-overlay-box.tsx` (label chip) | role-match |
| `apps/web/src/app/entity-types/page.tsx` | component | CRUD | `apps/web/src/app/page.tsx` | role-match |
| `apps/web/src/app/entity-types/_components/entity-type-detail.tsx` | component | CRUD | `nest-picker.tsx` | role-match |
| `apps/web/src/app/entity-types/_components/field-row-dialog.tsx` | component | CRUD | `nest-picker.tsx` | role-match |
| `packages/api-client/src/router/entity-types-write.ts` | service | CRUD | `packages/api-client/src/router/emails/mutations.ts` | exact |
| `apps/email-listener/app/presentation/api/v1/entity_types.py` | controller | CRUD | `apps/email-listener/app/presentation/api/v1/components.py` | exact |

---

## Pattern Assignments

### Area 1: Relationship Model Migration (D-02/03/04)

---

#### `packages/db/src/schema/enums.ts` (modify — add `componentRoleEnum`)

**Analog:** self (`packages/db/src/schema/enums.ts` lines 1-44)

**Imports pattern** (lines 1-3):
```typescript
import { pgEnum } from "drizzle-orm/pg-core";
```

**Core pattern** — copy the existing `extractionStatusEnum` structure exactly:
```typescript
// Add after existing enums
export const componentRoleEnum = pgEnum("component_role", [
  "entity",
  "field",
  "unrelated",
]);
```

**Convention:** Values are string literals in a readonly tuple. Export name is camelCase, first arg is snake_case DB enum name.

---

#### `packages/db/src/schema/components.ts` (modify — add role/entityTypeId/entityTypeFieldId columns)

**Analog:** self (`packages/db/src/schema/components.ts` lines 1-115)

**Imports pattern** — add to existing import block:
```typescript
import { componentRoleEnum } from "./enums";
import { EntityTypes, EntityTypeFields } from "./entity-types";
```

**Core pattern** — nullable FK columns follow `parentComponentId` style (plain uuid, no declared FK, for perf) vs `importerId` style (declared FK). D-03/D-04 use declared FK (cross-table integrity needed):
```typescript
// In EmailComponents table definition, after extractionStatus:
role: componentRoleEnum("role"),                          // nullable, no .notNull()
entityTypeId: uuid("entity_type_id")
  .references(() => EntityTypes.id, { onDelete: "set null" }),
entityTypeFieldId: uuid("entity_type_field_id")
  .references(() => EntityTypeFields.id, { onDelete: "set null" }),
```

**Index pattern** — add to the (t) => ({ ... }) second arg:
```typescript
componentRoleIdx: index("idx_email_components_role").on(t.role),
componentEntityTypeIdx: index("idx_email_components_entity_type_id").on(t.entityTypeId),
```

**Inferred types** — existing `EmailComponentRow` and `InsertEmailComponent` via `$inferSelect`/`$inferInsert` automatically include new columns. No additional exports needed.

---

### Area 2: Canvas Editor Surface (D-06..D-19)

---

#### `apps/web/src/app/emails/[id]/_components/canvas-shell.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` (lines 1-80)

**Imports pattern**:
```typescript
"use client";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@nauta/ui/resizable";
import { CanvasToolbar } from "./canvas-toolbar";
import { LayersPanel } from "./layers-panel";
import { InspectorPanel } from "./inspector-panel";
import { OverlayLayer } from "./overlay-layer";
import { DrawOverlay } from "./draw-overlay";
import { ActiveParentBanner } from "./active-parent-banner";
import type { CanvasState } from "./use-canvas-state";
```

**Core layout pattern** (09-UI-SPEC §Layout):
```typescript
// Outer: flex flex-col h-full (fills the page slot below app-shell header)
// Toolbar: h-11 shrink-0
// Inner row: flex flex-1 min-h-0 overflow-hidden
// Layers: w-64 shrink-0 border-r overflow-y-auto
// Canvas: flex-1 relative overflow-hidden  (contains OverlayLayer + DrawOverlay)
// Inspector: w-72 shrink-0 border-l overflow-y-auto
```

**Props interface pattern** — explicit readonly props, no index signatures:
```typescript
interface CanvasShellProps {
  readonly emailId: string;
  readonly state: CanvasState;
  readonly signedUrl: string;
  // ... other props passed through from page
}
```

---

#### `apps/web/src/app/emails/[id]/_components/canvas-toolbar.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` (lines 1-344)

**Imports pattern** (lines 1-15 of action-toolbar):
```typescript
"use client";

import { Button } from "@nauta/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nauta/ui/tooltip";
```

**Core toolbar pattern** (lines 20-40 of action-toolbar):
```typescript
// role="toolbar" aria-label="Canvas tools" aria-controls="region-overlay-layer"
// h-11 flex items-center gap-2 border-b px-4 bg-card shrink-0
// Tooltip > TooltipTrigger asChild > Button pattern for each tool
// Toggle button: aria-pressed={drawMode === "draw"} variant={drawMode === "draw" ? "secondary" : "ghost"}
```

**Draw mode toggle pattern** (from action-toolbar):
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant={drawMode === "draw" ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={drawMode === "draw"}
      onClick={() => onSetDrawMode(drawMode === "draw" ? "select" : "draw")}
    >
      Draw region
    </Button>
  </TooltipTrigger>
  <TooltipContent>Draw a new region (D)</TooltipContent>
</Tooltip>
```

**Active-parent mode visual** — when `activeParentId` is non-null, toolbar shows violet accent background on draw button. Matches role-color palette: entity=violet-500.

---

#### `apps/web/src/app/emails/[id]/_components/layers-panel.tsx` (new, replaces entities-list.tsx role)

**Analog:** `apps/web/src/app/emails/[id]/_components/entities-list.tsx` (lines 1-322)

**Imports pattern** (lines 1-20 of entities-list):
```typescript
"use client";

import { ScrollArea } from "@nauta/ui/scroll-area";
import { LayersTreeRow } from "./layers-tree-row";
```

**Core pattern** (lines 80-120 of entities-list — filter + list):
```typescript
// Filter: allComponents where sourceType === 'region'
// visibleComponents: exclude rejected/superseded unless showHistory
// ScrollArea wrapper: h-full
// ul role="list" divide-y
// LayersTreeRow per component (entity rows first, field children indented)
```

**Tree structure** — entity regions at top level, field regions indented (parentComponentId matches an entity region's id). Mirrors `parentComponentId` self-reference from components schema.

---

#### `apps/web/src/app/emails/[id]/_components/layers-tree-row.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/entities-list.tsx` (row `li` section, ~lines 140-200)

**Core row pattern**:
```typescript
// li role="listitem"
// button: w-full text-left hover:bg-muted aria-pressed={isActive}
// Role color dot: role="entity" → bg-violet-500, role="field" → bg-amber-500,
//                role="unrelated" → bg-slate-400, null → bg-primary
// Indent: pl-6 for child rows (parentComponentId !== null)
// onClick: setActiveComponentId(id)
```

**Role-color mapping** (D-08, 09-UI-SPEC §Color palette):
```typescript
const ROLE_COLOR: Record<string, string> = {
  entity: "bg-violet-500",
  field: "bg-amber-500",
  unrelated: "bg-slate-400",
};
const dotClass = component.role ? ROLE_COLOR[component.role] : "bg-primary";
```

---

#### `apps/web/src/app/emails/[id]/_components/inspector-panel.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/entities-list.tsx` (FieldsPanel section, ~lines 220-322)

**Core pattern**:
```typescript
// Shows details for activeComponent
// RolePicker: only when component.role is null or 'entity'/'field'/'unrelated'
// EntityTypePicker: only when role === 'entity' (existing entity-type-picker.tsx reused)
// FieldRelationshipPicker: only when role === 'field'
// ConfirmDenyControls: when extractionStatus === 'candidate' or 'review_pending'
// Empty state: "Select a region to inspect"
// ScrollArea h-full, padding p-4
```

---

#### `apps/web/src/app/emails/[id]/_components/role-picker.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx` (lines 1-98)

**Full pattern** (entity-type-picker.tsx):
```typescript
"use client";

import { useState } from "react";
import { Button } from "@nauta/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@nauta/ui/popover";

// Controlled Popover: open/onOpenChange as props
// Static items (no fetch needed — enum values are known):
//   "entity" → "Entity (parent document)"
//   "field" → "Field (child value)"
//   "unrelated" → "Unrelated / ignore"
// Items: role="option" aria-selected={current === value} button
//        onClick: onSelect(value); onOpenChange(false)
// Width: w-56 p-2
// Current selection shown on trigger button as colored dot + label
```

**Key difference from entity-type-picker:** No async fetch — role values are static enum. No `useQuery`, no `Skeleton` loading state.

---

#### `apps/web/src/app/emails/[id]/_components/field-relationship-picker.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx` (lines 1-98, full file)

**Imports pattern** (lines 1-12 of entity-type-picker):
```typescript
"use client";

import { Skeleton } from "@nauta/ui/skeleton";
import { Button } from "@nauta/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@nauta/ui/popover";
import { api } from "~/trpc/react";
```

**Core pattern** — same lazy-fetch Popover as entity-type-picker, but fetches entity type's fields:
```typescript
// open/onOpenChange controlled props
// Lazy fetch: api.entityTypes.list.useQuery(undefined, { enabled: open })
// Filter displayed items to fields belonging to the selected entity type's id
// Loading: 3 Skeleton rows (h-9 w-full rounded)
// Empty: text-sm text-muted-foreground "No fields defined for this entity type"
// Items: role="option" aria-selected button, hover:bg-muted
//        label = field.label, sublabel = field.fieldType
// Width: w-72 p-3
// onSelect: callback(entityTypeId, entityTypeFieldId)
```

---

#### `apps/web/src/app/emails/[id]/_components/confirm-deny-controls.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx` (lines 1-85)

**Core pattern** (draw-mode-bar.tsx lines 30-85):
```typescript
// role="group" aria-label="Confirm or deny region"
// Positioned absolute: z-30 (above overlay z-10 and draw z-20)
// Per 09-UI-SPEC: anchored bottom-right of the region box in canvas
// flex gap-2 items-center
// Confirm button: variant="default" size="sm" (green accent or default)
//   onClick: onConfirm()
// Deny button: variant="destructive" size="sm" OR variant="ghost"
//   onClick: onDeny()
// Origin-aware deny (D-18):
//   auto-detected box (isAutoDetected=true): reject + hide entire component
//   user-drawn box (isAutoDetected=false): keep geometry, clear candidate value only
```

---

#### `apps/web/src/app/emails/[id]/_components/active-parent-banner.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/draw-mode-bar.tsx` (lines 1-85, full file)

**Full pattern** from draw-mode-bar.tsx:
```typescript
"use client";

// role="status" aria-live="polite"
// flex flex-wrap items-center gap-3 border-b px-4 py-2 bg-violet-50 dark:bg-violet-950/20 text-sm
// (violet tint because active-parent mode is entity-scoped — role-color entity=violet-500)

const HEADINGS: Record<ActiveParentMode, string> = {
  drawing: "Drawing field region — click canvas to place",
  selecting: "Entity selected — draw boxes to add field regions",
};

// Cancel button: variant="ghost" size="sm" aria-keyshortcuts="Escape"
//   onClick: onClearActiveParent()
// Shows entity label when available: "Entity: Bill of Lading"
```

---

#### `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` (modify — add role prop)

**Analog:** self (lines 1-178)

**Existing status-class pattern** (lines 60-75):
```typescript
const statusClasses =
  component.extractionStatus === "pending"
    ? "border-primary/50 border-dashed bg-primary/[0.08]"
    : component.extractionStatus === "rejected" || component.extractionStatus === "superseded"
      ? "border-border/40 border-dashed bg-muted/50 opacity-40"
      : "border-primary/80 bg-primary/10";
```

**New role-color override** — add after statusClasses, applied when role is non-null and status is not rejected/superseded:
```typescript
// Role-color palette overrides default primary color for classified regions
const ROLE_BORDER: Record<string, string> = {
  entity: "border-violet-500/80 bg-violet-500/10",
  field: "border-amber-500/80 bg-amber-500/10",
  unrelated: "border-slate-400/40 bg-slate-400/[0.06] opacity-60",
};
const roleClass =
  component.role && !["rejected", "superseded"].includes(component.extractionStatus)
    ? ROLE_BORDER[component.role]
    : null;
// In className: roleClass ?? statusClasses
```

**Label chip** — add role badge beside existing label chip:
```typescript
// absolute -top-5 left-0 flex gap-1
// Existing label chip kept; add role dot: w-2 h-2 rounded-full + ROLE_COLOR[role]
```

---

#### `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` (modify — add roleFilter, activeParentId)

**Analog:** self (lines 1-118)

**Existing filter pattern** (lines 40-60):
```typescript
// sourceType === 'region' && hasPolygon && pageIndex === currentPage-1 && (!rejected/superseded || showHistory)
```

**New props to add**:
```typescript
interface OverlayLayerProps {
  // ... existing props ...
  readonly roleFilter?: "entity" | "field" | "unrelated" | null; // null = show all
  readonly activeParentId?: string | null;
}
```

**New filter logic**:
```typescript
// After existing filter: if roleFilter != null, further filter to components where role === roleFilter
const visibleComponents = filtered.filter(c =>
  roleFilter == null || c.role === roleFilter
);
```

---

#### `apps/web/src/app/emails/[id]/_components/use-canvas-state.ts` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` (lines 1-379)

**Imports pattern** (lines 1-18 of use-region-edit):
```typescript
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
```

**State machine pattern** (lines 20-60 of use-region-edit):
```typescript
// Active parent state (D-10):
const [activeParentId, setActiveParentId] = useState<string | null>(null);
// Selecting entity sets activeParentId; subsequently drawn boxes auto-assign as field children
// Escape / explicit clear: setActiveParentId(null)

// Draw mode:
type CanvasMode = "select" | "draw" | "draw-field"; // draw-field = drawing with active parent
const [mode, setMode] = useState<CanvasMode>("select");
```

**Return shape** (immutable — spread new objects):
```typescript
// Return named object — never mutate state directly
return {
  activeParentId,
  mode,
  setActiveParentId,
  setMode,
  // ... other state
} as const;
```

---

#### `apps/web/src/app/emails/[id]/_components/use-role-mutations.ts` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` (lines 120-250)

**Full optimistic update pattern** (lines 130-180 of use-region-edit):
```typescript
const utils = api.useUtils();

const setRole = api.emails.setRole.useMutation({
  onMutate: async ({ componentId, role }) => {
    await utils.emails.detail.cancel({ id: emailId });
    const prevData = utils.emails.detail.getData({ id: emailId });
    utils.emails.detail.setData({ id: emailId }, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        components: prev.components.map((c) =>
          c.id === componentId ? { ...c, role } : c,
        ),
      };
    });
    return { prevData };
  },
  onSuccess: async () => {
    await utils.emails.detail.invalidate({ id: emailId });
    toast.success("Role updated");
  },
  onError: (_err, _vars, context) => {
    if (context?.prevData !== undefined) {
      utils.emails.detail.setData({ id: emailId }, context.prevData);
    }
    toast.error("Could not update role. Try again.");
  },
});
```

**Apply same pattern for:** `setEntityType`, `setFieldRelationship`, `autofillFields`, `confirmField`, `denyField`.

**mutatingComponentIds pattern** (lines 280-310 of use-region-edit):
```typescript
const mutatingComponentIds = [
  setRole.isPending && setRole.variables?.componentId,
  setEntityType.isPending && setEntityType.variables?.componentId,
  // ...
].filter(Boolean) as string[];
```

---

#### `apps/web/src/app/emails/[id]/_components/use-autofill-fields.ts` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/use-autofill.ts` (lines 1-248, full file)

**Phase state machine pattern** (lines 20-50 of use-autofill):
```typescript
// Sub-field autofill has similar phases:
type AutofillFieldsPhase = "idle" | "extracting" | "reviewing" | "confirmed" | "failed";
// Per-component: Record<entityComponentId, AutofillFieldsPhase>
const [phases, setPhases] = useState<Record<string, AutofillFieldsPhase>>({});
```

**No optimistic update** (lines 100-120 of use-autofill) — autofill creates new candidate rows server-side; results come back as new components in the next invalidation:
```typescript
// After mutation success: invalidate detail query to pick up new field candidates
await utils.emails.detail.invalidate({ id: emailId });
```

**Error pattern** (lines 190-210 of use-autofill):
```typescript
toast.error("Autofill failed — please try again.", { duration: 6000 });
setPhases((prev) => ({ ...prev, [entityComponentId]: "failed" }));
```

---

### Area 3: Sub-field Autofill Use Case + Endpoint (D-13/14/15)

---

#### `packages/api-client/src/router/emails/mutations.ts` (modify — add setRole, setEntityType, setFieldRelationship, autofillFields, confirmField, denyField)

**Analog:** self (lines 1-414)

**getListenerConfig guard** (lines 5-14 — copy exactly, never change):
```typescript
function getListenerConfig(): { url: string; apiKey: string } {
  const url = process.env.EMAIL_LISTENER_URL;
  const apiKey = process.env.EMAIL_LISTENER_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "EMAIL_LISTENER_URL or EMAIL_LISTENER_API_KEY is not configured",
    );
  }
  return { url, apiKey };
}
```

**parseErrorDetail helper** (lines 16-22 — copy exactly):
```typescript
async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}
```

**New mutation shape** — copy `accept` mutation structure (lines 60-80), substituting endpoint and input schema:
```typescript
setRole: publicProcedure
  .input(z.object({
    componentId: z.string().uuid(),
    role: z.enum(["entity", "field", "unrelated"]).nullable(),
  }))
  .mutation(async ({ input }) => {
    const { url, apiKey } = getListenerConfig();
    const res = await fetch(`${url}/v1/components/${input.componentId}/role`, {
      method: "PATCH",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ role: input.role }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, "setRole failed"));
    }
    return res.json() as Promise<unknown>;
  }),

// autofillFields: POST /v1/components/{entity_id}/autofill-fields
autofillFields: publicProcedure
  .input(z.object({ entityComponentId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { url, apiKey } = getListenerConfig();
    const res = await fetch(
      `${url}/v1/components/${input.entityComponentId}/autofill-fields`,
      {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, "autofillFields failed"));
    }
    return res.json() as Promise<unknown>;
  }),
```

**Security invariant:** `X-API-Key` is present only inside this server-side procedure. Never in client code, never `NEXT_PUBLIC_` prefixed.

---

#### `packages/api-client/src/router/emails/detail.ts` (modify — add role/entityTypeId/entityTypeFieldId to component select)

**Analog:** self (lines 86-135)

**Existing component select shape** (lines 87-115):
```typescript
const componentRows = await ctx.db
  .select({
    id: EmailComponents.id,
    // ... existing fields ...
    entityTypeLabel: EntityTypes.label,
    entityTypeSlug: EntityTypes.slug,
  })
```

**New fields to add** to the `.select({})` shape:
```typescript
role: EmailComponents.role,
entityTypeId: EmailComponents.entityTypeId,
entityTypeFieldId: EmailComponents.entityTypeFieldId,
```

**No join change needed** — `EntityTypes` is already joined via `ExtractionRecords.entityTypeId`. The new `entityTypeId` column on `EmailComponents` is a direct column read, not a join.

---

#### `packages/api-client/src/router/entity-types.ts` (modify — add createEntityType, updateEntityType, deleteEntityType, createField, updateField, deleteField)

**Analog:** self (lines 1-144) + `packages/api-client/src/router/emails/mutations.ts` for the write shape

**Existing read pattern** (lines 60-90 of entity-types.ts):
```typescript
export const entityTypesRouter = createTRPCRouter({
  list: publicProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    // Drizzle leftJoin + groupEntityTypeRows
  }),
});
```

**New write procedures** — add to `entityTypesRouter` using `getListenerConfig()` + fetch pattern from mutations.ts:
```typescript
create: publicProcedure
  .input(z.object({
    slug: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
    description: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const { url, apiKey } = getListenerConfig();
    const res = await fetch(`${url}/v1/entity-types`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseErrorDetail(res, "create failed"));
    return res.json() as Promise<unknown>;
  }),
```

**Note:** `getListenerConfig` and `parseErrorDetail` are currently in `emails/mutations.ts`. Either extract to a shared `_config.ts` within the router package, or duplicate — the planner should decide. Pattern is identical either way.

---

#### `apps/email-listener/app/application/use_cases/autofill_fields.py` (new)

**Analog:** `apps/email-listener/app/application/use_cases/autofill.py` (lines 1-204, full file)

**Imports pattern** (lines 18-34 of autofill.py):
```python
from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog

from app.domain.ports.component_repository import ComponentRepository
from app.domain.ports.autofill_protocol import AutofillProtocol, AutofillResult
from app.domain.ports.entity_type_repository import EntityTypeRepository
from app.domain.ports.extraction_repository import ExtractionRepository
```

**Class structure** (lines 46-86 of autofill.py — replicate):
```python
class AutofillFieldsUseCase:
    """Extract fields for ALL field-role child regions of an entity component.

    D-13 contract: entity component must have role='entity' and entity_type_id set.
    Iterates child components (role='field'), calls AutofillProtocol per child,
    persists ExtractionRecord per child.

    Architecture contract: imports ONLY domain ports and entities.
    """

    def __init__(
        self,
        *,
        components: ComponentRepository,
        entity_types: EntityTypeRepository,
        extractions: ExtractionRepository,
        autofiller: AutofillProtocol,
    ) -> None:
        self._components = components
        self._entity_types = entity_types
        self._extractions = extractions
        self._autofiller = autofiller
```

**Tenant derivation** (lines 117-122 of autofill.py — copy exactly):
```python
# D-18: derive tenant from the component itself; explicit mismatch 404s
if importer_id is not None and component.importer_id != importer_id:
    log.warning("autofill_fields_component_importer_mismatch")
    raise ValueError(f"Component not found: {component_id}")
importer_id = component.importer_id
```

**structlog binding pattern** (lines 105-109 of autofill.py):
```python
log = logger.bind(
    entity_component_id=entity_component_id,
)
log.info("autofill_fields_start")
```

---

#### `apps/email-listener/app/presentation/api/v1/components.py` (modify — add `/autofill-fields`, `/role`, `/entity-type`, `/field-relationship` endpoints)

**Analog:** self (lines 139-240)

**Pydantic request model pattern** (lines 60-75):
```python
class AutofillRequest(BaseModel):
    entity_type_slug: str

class RoleRequest(BaseModel):
    role: Literal["entity", "field", "unrelated"] | None = None

class EntityTypeRequest(BaseModel):
    entity_type_id: str | None = None

class FieldRelationshipRequest(BaseModel):
    entity_type_id: str | None = None
    entity_type_field_id: str | None = None
```

**Endpoint pattern** (lines 139-168 — copy autofill_component exactly, substitute):
```python
@router.post("/{component_id}/autofill-fields")
@inject
async def autofill_fields(
    component_id: UUID,
    use_case: FromDishka[AutofillFieldsUseCase],
) -> ApiResponse[AutofillResultView]:
    """Run autofill for all field-role children of the given entity component."""
    try:
        result = await use_case.execute(entity_component_id=str(component_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc
    return ApiResponse.ok(result)

@router.patch("/{component_id}/role")
@inject
async def set_component_role(
    component_id: UUID,
    body: RoleRequest,
    use_case: FromDishka[SetComponentRoleUseCase],
) -> ApiResponse[RegionView]:
    try:
        component = await use_case.execute(
            component_id=str(component_id), role=body.role
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc
    return ApiResponse.ok(RegionView(component_id=component.id, extraction_status=component.extraction_status))
```

**Error pattern** (lines 159-160 — replicate for all new endpoints):
```python
except ValueError as exc:
    raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc
```

**Auth** — all routes already protected by `dependencies=[Depends(require_api_key)]` on the router. No per-endpoint auth needed.

---

### Area 4: App-Wide Surfaces (D-20..D-27)

---

#### `apps/web/src/app/layout.tsx` (modify — add sidebar shell, ThemeProvider)

**Analog:** self (lines 1-25)

**Existing structure** (lines 1-25 of layout.tsx):
```typescript
import { TRPCReactProvider } from "~/trpc/react";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

**Modified structure** (D-20/D-21):
```typescript
import { ThemeProvider } from "~/components/theme-provider";
import { SidebarProvider } from "@nauta/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";

// html: suppressHydrationWarning (next-themes requirement)
// ThemeProvider: attribute="class" defaultTheme="system" enableSystem
// SidebarProvider wraps children + AppSidebar
// flex h-screen overflow-hidden outer container
```

---

#### `packages/ui/src/sidebar.tsx` (new — shadcn sidebar block)

**Analog:** `packages/ui/src/resizable.tsx` (lines 1-45) for the export/registry shape

**resizable.tsx export pattern** (lines 1-45):
```typescript
"use client";

import * as SomePrimitive from "some-package";
import { cn } from "@nauta/ui";

const ComponentName = ({ className, ...props }: React.ComponentProps<typeof SomePrimitive.X>) => (
  <SomePrimitive.X className={cn("base-classes", className)} {...props} />
);

export { ComponentName };
```

**Sidebar-specific:** Use shadcn `sidebar` component registry output verbatim. The `cn` import comes from `@nauta/ui` (barrel). Export named: `{ SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton }`.

**Glass aesthetic** (D-21, 09-UI-SPEC §Glass):
```typescript
// Sidebar inner surface:
// bg-background/70 backdrop-blur-md border-r border-border/50
```

---

#### `apps/web/src/components/app-sidebar.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` for prop interface pattern

**Imports pattern**:
```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@nauta/ui/sidebar";
```

**Active-link pattern** — `usePathname()` to derive `isActive`:
```typescript
const pathname = usePathname();
const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
// SidebarMenuButton: isActive prop + aria-current={isActive(href) ? "page" : undefined}
```

**Nav items** (D-20):
```typescript
const NAV_ITEMS = [
  { href: "/", label: "Inbox", icon: InboxIcon },
  { href: "/entity-types", label: "Entity Types", icon: TagIcon },
] as const;
```

---

#### `apps/web/src/components/theme-provider.tsx` (new)

**Analog:** none — standard `next-themes` boilerplate, no existing analog in codebase.

**Pattern** (from next-themes docs):
```typescript
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

---

#### `apps/web/src/app/page.tsx` (modify — replace card list with inbox-three-pane)

**Analog:** self (lines 1-121)

**Existing query** (lines 30-33 — keep, pass to InboxThreePane):
```typescript
const { data, isLoading, isError, error } = api.emails.list.useQuery({
  limit: 50,
  offset: 0,
});
```

**Existing error pattern** (lines 37-41 — keep):
```typescript
useEffect(() => {
  if (isError && error) {
    console.error("[EmailsPage] tRPC error:", error);
  }
}, [isError, error]);
```

**Replace** the JSX body with `<InboxThreePane data={data} isLoading={isLoading} isError={isError} />`.

---

#### `apps/web/src/app/_components/inbox-three-pane.tsx` (new)

**Analog:** `apps/web/src/app/page.tsx` (lines 44-121) for the email list rendering + `packages/ui/src/resizable.tsx` for three-pane layout

**resizable.tsx pattern** (full file — 45 lines):
```typescript
// ResizablePanelGroup direction="horizontal" className="h-full"
//   ResizablePanel defaultSize={25} minSize={15}  → email list pane
//   ResizableHandle withHandle
//   ResizablePanel defaultSize={50}               → reading pane (iframe / body)
//   ResizableHandle withHandle
//   ResizablePanel defaultSize={25} minSize={15}  → entity chips pane
```

**Glass aesthetic** (D-22, 09-UI-SPEC §Glass):
```typescript
// Panel backgrounds: bg-background/70 backdrop-blur-md
// Borders: border-border/50
// Email list row hover: hover:bg-muted/50 (same as current Card hover)
```

---

#### `apps/web/src/app/_components/inbox-row.tsx` (new)

**Analog:** `apps/web/src/app/page.tsx` (lines 83-115 — the Link > Card block)

**Core pattern** (lines 83-115 of page.tsx):
```typescript
<Link key={email.id} href={`/emails/${email.id}`} className="block">
  <Card className="hover:bg-muted/50 transition-colors">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <CardTitle className="text-base leading-snug">
          {email.subject ?? "(no subject)"}
        </CardTitle>
        <Badge variant={parseStatusVariant(email.parseStatus)}>
          {email.parseStatus}
        </Badge>
      </div>
      // sender, date, preview
    </CardHeader>
  </Card>
</Link>
```

**Extend** with entity chips below the preview text when `email.entityTypes` (from D-23 query join) is non-empty.

---

#### `apps/web/src/app/_components/entity-chips.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` (label chip section, lines 110-130)

**Label chip pattern** from region-overlay-box (lines 110-115):
```typescript
// absolute -top-5 left-0 text-xs font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded
```

**Adapted for inline chips**:
```typescript
// flex flex-wrap gap-1
// Per entity type: Badge variant="outline" with violet-500 dot prefix
// Role-color: entity=violet-500, unrelated=slate-400
// Max 3 shown, "+N more" overflow badge
```

---

#### `apps/web/src/app/entity-types/page.tsx` (new)

**Analog:** `apps/web/src/app/page.tsx` (lines 1-121 — list pattern)

**Core query pattern** (lines 30-33 of page.tsx — adapt for entityTypes):
```typescript
"use client";
import { api } from "~/trpc/react";

const { data, isLoading, isError } = api.entityTypes.list.useQuery();
```

**List rendering** — same Skeleton/error/empty/list pattern as page.tsx. Each item links to detail view. "Create new entity type" button triggers dialog.

---

#### `apps/web/src/app/entity-types/_components/entity-type-detail.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` for prop-driven controlled component shape

**nest-picker.tsx pattern** (lines 39-98):
```typescript
// Controlled props: open/onOpenChange/onSave/onDelete
// Popover or Dialog (Dialog preferred for CRUD forms)
// Fields list with edit/delete per field
// "Add field" inline form
```

---

#### `apps/web/src/app/entity-types/_components/field-row-dialog.tsx` (new)

**Analog:** `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` (controlled dialog/popover shape)

**Pattern**:
```typescript
// Dialog (from @nauta/ui/dialog) for create/edit field
// Input: slug, label, description, fieldType (select), isRequired (checkbox), sortOrder
// Zod validation at boundary before mutation call
// onSave: api.entityTypes.createField.mutate({ entityTypeId, ...fieldData })
// onDelete: api.entityTypes.deleteField.mutate({ fieldId })
```

---

## Shared Patterns

### 1. Server-Side Environment Guard
**Source:** `packages/api-client/src/router/emails/mutations.ts` lines 5-14
**Apply to:** ALL new tRPC mutations that call FastAPI (`setRole`, `setEntityType`, `setFieldRelationship`, `autofillFields`, `confirmField`, `denyField`, entity-type write mutations)
```typescript
function getListenerConfig(): { url: string; apiKey: string } {
  const url = process.env.EMAIL_LISTENER_URL;
  const apiKey = process.env.EMAIL_LISTENER_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "EMAIL_LISTENER_URL or EMAIL_LISTENER_API_KEY is not configured",
    );
  }
  return { url, apiKey };
}
```
**Invariant:** Never read at module init. Never `NEXT_PUBLIC_`. Never in client-side code.

### 2. Optimistic Update Pattern
**Source:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` lines 130-200
**Apply to:** `use-role-mutations.ts` — all six mutations (setRole, setEntityType, setFieldRelationship, confirmField, denyField; NOT autofillFields which produces new rows)
```typescript
onMutate: async ({ componentId, ...patch }) => {
  await utils.emails.detail.cancel({ id: emailId });
  const prevData = utils.emails.detail.getData({ id: emailId });
  utils.emails.detail.setData({ id: emailId }, (prev) => {
    if (!prev) return prev;
    return { ...prev, components: prev.components.map((c) =>
      c.id === componentId ? { ...c, ...patch } : c
    )};
  });
  return { prevData };
},
onSuccess: async () => { await utils.emails.detail.invalidate({ id: emailId }); },
onError: (_err, _vars, context) => {
  if (context?.prevData !== undefined) {
    utils.emails.detail.setData({ id: emailId }, context.prevData);
  }
  toast.error("...");
},
```

### 3. Toast Error Pattern
**Source:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` lines 180-195
**Apply to:** All new mutation hooks
```typescript
toast.success("Role updated");           // onSuccess
toast.error("Could not update role. Try again.");  // onError
// For autofill specifically (from use-autofill.ts line 190):
toast.error("Autofill failed — please try again.", { duration: 6000 });
```

### 4. FastAPI ValueError → 404 Pattern
**Source:** `apps/email-listener/app/presentation/api/v1/components.py` lines 154-160
**Apply to:** ALL new FastAPI endpoints in components.py and entity_types.py
```python
try:
    result = await use_case.execute(...)
except ValueError as exc:
    raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc
```

### 5. Drizzle Nullable FK Column Pattern
**Source:** `packages/db/src/schema/entity-types.ts` lines 38-41
**Apply to:** New columns in `components.ts` (entityTypeId, entityTypeFieldId)
```typescript
importerId: uuid("importer_id").references(() => Importers.id, {
  onDelete: "cascade",
}),
// Nullable = no .notNull(); onDelete: "set null" for role-related FKs
```

### 6. Zod Input Validation at tRPC Boundary
**Source:** `packages/api-client/src/router/emails/mutations.ts` (all procedures)
**Apply to:** All new tRPC mutations
```typescript
.input(z.object({
  componentId: z.string().uuid(),     // always uuid, never raw string
  role: z.enum(["entity", "field", "unrelated"]).nullable(),
}))
```

### 7. Tenant-from-Component Pattern
**Source:** `apps/email-listener/app/application/use_cases/autofill.py` lines 117-122
**Apply to:** `autofill_fields.py`, `SetComponentRoleUseCase`, any new use case that touches components
```python
# importer_id derived from component row, never from caller
if importer_id is not None and component.importer_id != importer_id:
    raise ValueError(f"Component not found: {component_id}")
importer_id = component.importer_id
```

### 8. Glass Aesthetic
**Source:** 09-UI-SPEC §Glass + 09-CONTEXT.md D-21/D-22
**Apply to:** `app-sidebar.tsx`, `inbox-three-pane.tsx` panel backgrounds, sidebar.tsx inner surface
```typescript
// Panel/sidebar: bg-background/70 backdrop-blur-md border-border/50
// Row hover: hover:bg-muted/50
// NOT applied to canvas overlay components (they use z-stack colors)
```

### 9. Role-Color Palette
**Source:** 09-CONTEXT.md D-08, 09-UI-SPEC §Color palette
**Apply to:** `region-overlay-box.tsx`, `layers-tree-row.tsx`, `role-picker.tsx`, `entity-chips.tsx`
```typescript
const ROLE_COLORS = {
  entity:     { border: "border-violet-500/80", bg: "bg-violet-500/10", dot: "bg-violet-500" },
  field:      { border: "border-amber-500/80",  bg: "bg-amber-500/10",  dot: "bg-amber-500"  },
  unrelated:  { border: "border-slate-400/40",  bg: "bg-slate-400/[0.06]", dot: "bg-slate-400" },
  // null/undefined → primary color (unchanged from Phase 6)
} as const;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/web/src/components/theme-provider.tsx` | provider | event-driven | No theme provider exists; standard next-themes boilerplate |
| `packages/ui/src/sidebar.tsx` | component | event-driven | Confirmed absent from packages/ui/src/; shadcn registry output |

---

## Metadata

**Analog search scope:** `packages/db/src/schema/`, `packages/api-client/src/router/`, `apps/web/src/app/emails/[id]/_components/`, `apps/web/src/app/`, `apps/web/src/app/layout.tsx`, `apps/email-listener/app/application/use_cases/`, `apps/email-listener/app/presentation/api/v1/`, `packages/ui/src/`
**Files scanned:** 22 source files read directly
**Pattern extraction date:** 2026-06-13
