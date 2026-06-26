# Phase 7: Click-to-autofill UI — Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/api-client/src/router/emails/mutations.ts` | service | request-response | self (extend) | exact |
| `packages/api-client/src/router/entity-types.ts` | service | CRUD | `packages/api-client/src/router/emails/detail.ts` | role-match |
| `packages/api-client/src/router/emails/detail.ts` | service | CRUD | self (extend) | exact |
| `packages/api-client/src/root.ts` | config | — | self (extend) | exact |
| `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` | hook | event-driven | self (extend) | exact |
| `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` | component | event-driven | self (extend) | exact |
| `apps/web/src/app/emails/[id]/_components/entities-list.tsx` | component | event-driven | self (extend) | exact |
| `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | component | event-driven | self (extend) | exact |
| `apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx` | component | request-response | `apps/web/src/app/emails/[id]/_components/nest-picker.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/fields-panel.tsx` | component | event-driven | `apps/web/src/app/emails/[id]/_components/entities-list.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/reprocess-dialog.tsx` | component | event-driven | `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx` | exact |

---

## Pattern Assignments

### `packages/api-client/src/router/emails/mutations.ts` — extend with 3 new mutations

**Analog:** self — `packages/api-client/src/router/emails/mutations.ts`

**Proxy idiom — copy this pattern exactly for all three new mutations** (lines 22-55, 66-85):

```typescript
// Server-side env guard — read at call time (T-06-10)
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

async function parseErrorDetail(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}
```

**Mutation template — copy from `accept` (lines 66-85), adapting path/body/schema:**

```typescript
accept: publicProcedure
  .input(z.object({ componentId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { url, apiKey } = getListenerConfig();
    const res = await fetch(
      `${url}/v1/components/${input.componentId}/accept`,
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, "accept failed"));
    }
    return res.json() as Promise<unknown>;
  }),
```

**Three new mutations to add (schemas + paths):**

```typescript
// autofillComponent — POST /v1/components/{id}/autofill  body: {entity_type_slug}
autofillComponent: publicProcedure
  .input(z.object({
    componentId: z.string().uuid(),
    entityTypeSlug: z.string().min(1),
  }))
  .mutation(async ({ input }) => {
    const { url, apiKey } = getListenerConfig();
    const res = await fetch(
      `${url}/v1/components/${input.componentId}/autofill`,
      {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type_slug: input.entityTypeSlug }),
      },
    );
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, "autofill failed"));
    }
    return res.json() as Promise<{
      data: {
        extracted_fields: Record<string, unknown>;
        confidence_score: number;
        confidence_breakdown: Record<string, unknown> | null;
      };
    }>;
  }),

// confirmComponent — POST /v1/components/{id}/confirm  body: {corrected_fields}
confirmComponent: publicProcedure
  .input(z.object({
    componentId: z.string().uuid(),
    correctedFields: z.record(z.unknown()).nullable(),
  }))
  .mutation(async ({ input }) => { /* same pattern */ }),

// reprocessEmail — POST /v1/emails/{id}/reprocess  body: {}
reprocessEmail: publicProcedure
  .input(z.object({ emailId: z.string().uuid() }))
  .mutation(async ({ input }) => { /* same pattern; url: /v1/emails/${input.emailId}/reprocess */ }),
```

**FastAPI response envelope:** FastAPI wraps all responses in `ApiResponse<T>` with shape `{ data: T, ok: bool }`. The tRPC proxy returns `res.json() as Promise<unknown>` — the React hook accesses `.data` from the result.

---

### `packages/api-client/src/router/entity-types.ts` — new tRPC router (Drizzle read)

**Analog:** `packages/api-client/src/router/emails/detail.ts`

**Imports pattern** (lines 1-25 of detail.ts):

```typescript
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import {
  EntityTypes,
  EntityTypeFields,    // ← add this for Phase 7
} from "@nauta/db/schema";

import { createTRPCRouter, publicProcedure } from "../../trpc";
```

**Router structure** — use `createTRPCRouter` (not plain object spread; this is a new top-level router):

```typescript
export const entityTypesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      // Drizzle: entity_types join entity_type_fields, is_active=true, order by label ASC
      const rows = await ctx.db
        .select({
          slug: EntityTypes.slug,
          label: EntityTypes.label,
          description: EntityTypes.description,
          // field columns:
          fieldKey: EntityTypeFields.slug,      // EntityTypeFields.slug = machine key
          fieldLabel: EntityTypeFields.label,
          fieldDataType: EntityTypeFields.fieldType,
          fieldIsRequired: EntityTypeFields.isRequired,
          fieldSortOrder: EntityTypeFields.sortOrder,
        })
        .from(EntityTypes)
        .leftJoin(EntityTypeFields, eq(EntityTypeFields.entityTypeId, EntityTypes.id))
        .where(eq(EntityTypes.isActive, true))
        .orderBy(EntityTypes.label, EntityTypeFields.sortOrder);
      // Group rows into { slug, label, description, fields[] } in application layer
      return groupEntityTypeRows(rows);
    }),
});
```

**DB column names from `packages/db/src/schema/entity-types.ts`:**
- `EntityTypes`: `id`, `slug`, `label`, `description`, `isActive`, `importerId`
- `EntityTypeFields`: `id`, `entityTypeId`, `slug` (machine key), `label`, `description`, `fieldType` (maps to `dataType`), `isRequired`, `sortOrder`

**Registration in `packages/api-client/src/root.ts`:**

```typescript
// Current root.ts (line 1-9):
import { emailsRouter } from "./router/emails";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  emails: emailsRouter,
});

// Phase 7 delta — add:
import { entityTypesRouter } from "./router/entity-types";
export const appRouter = createTRPCRouter({
  emails: emailsRouter,
  entityTypes: entityTypesRouter,   // ← new
});
```

---

### `packages/api-client/src/router/emails/detail.ts` — extend select with missing fields

**Analog:** self — `packages/api-client/src/router/emails/detail.ts`

**Current select block** (lines 86-98) — what is already selected:

```typescript
.select({
  id: EmailComponents.id,
  attachmentId: EmailComponents.attachmentId,
  parentComponentId: EmailComponents.parentComponentId,
  sourceType: EmailComponents.sourceType,
  contentText: EmailComponents.contentText,
  extractionStatus: EmailComponents.extractionStatus,
  location: EmailComponents.location,
  entityTypeLabel: EntityTypes.label,
  entityTypeSlug: EntityTypes.slug,
  extractedFields: ExtractionRecords.extractedFields,      // already present
  confidenceScore: ExtractionRecords.confidenceScore,      // already present
})
```

**Missing fields to add** (from `packages/db/src/schema/extractions.ts`):

```typescript
// Add to the .select({}) block:
correctedFields: ExtractionRecords.correctedFields,         // jsonb, nullable
confidenceBreakdown: ExtractionRecords.confidenceBreakdown, // jsonb, nullable
extractionRecordStatus: ExtractionRecords.status,           // "candidate" | "confirmed" | "superseded"
```

Note: `entityTypeSlug` is already selected (line 97 in current detail.ts). The leftJoin on `ExtractionRecords` and `EntityTypes` is already present (lines 100-111); no join changes needed.

---

### `apps/web/src/app/emails/[id]/_components/entity-type-picker.tsx` — new component

**Analog:** `apps/web/src/app/emails/[id]/_components/nest-picker.tsx`

**Full imports pattern** (lines 1-8 of nest-picker.tsx):

```typescript
"use client";

import { Button } from "@nauta/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nauta/ui/popover";
```

**Add for entity-type-picker (new imports beyond nest-picker):**

```typescript
import { Skeleton } from "@nauta/ui/skeleton";
import { api } from "~/trpc/react";
```

**Popover open/close + trigger pattern** (lines 48-60 of nest-picker.tsx):

```typescript
<Popover open={open} onOpenChange={onOpenChange}>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      aria-label="Nest into parent region"
      aria-expanded={open}
    >
      ⤵ Nest into…
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-64" aria-label="Select parent region">
    <p className="text-sm font-semibold pb-2">Nest into parent region</p>
    ...
  </PopoverContent>
</Popover>
```

**Entity-type-picker delta vs nest-picker:**
- `PopoverContent className="w-72"` (wider than nest-picker's `w-64`)
- `aria-label="Select entity type"` + `role="listbox"` on the options container
- Row pattern: `<button>` (not `<Button>` component) with `role="option"` `aria-selected="false"`, `text-left w-full px-3 py-2 hover:bg-muted rounded-sm`; two-line content (label + description)
- Loading state: `<Skeleton className="h-20 w-full rounded" />` while `entityTypes.list` isLoading
- Empty state: `<p className="text-sm text-muted-foreground py-3 px-3">No entity types configured.</p>`
- On row click: call `onSelect(row.slug)` then `onOpenChange(false)`

**Props interface pattern** (copy structure from lines 22-28 of nest-picker.tsx):

```typescript
interface EntityTypePickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (entityTypeSlug: string) => void;
}
```

---

### `apps/web/src/app/emails/[id]/_components/reprocess-dialog.tsx` — new component

**Analog:** `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx` (exact structural copy)

**Full file pattern** (lines 1-55 of reject-dialog.tsx):

```typescript
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nauta/ui/alert-dialog";
import { buttonVariants } from "@nauta/ui/button";

interface ReprocessDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

export function ReprocessDialog({
  open,
  onOpenChange,
  onConfirm,
}: ReprocessDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this region?</AlertDialogTitle>   {/* → "Reprocess this email?" */}
          <AlertDialogDescription>...</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep region</AlertDialogCancel>           {/* → "Keep current data" */}
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}  {/* → variant: "default" (non-destructive) */}
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

**Key delta from reject-dialog:** `AlertDialogAction` uses `buttonVariants({ variant: "default" })` not `"destructive"` — reprocessing is additive (D-16: supersede, never delete).

**Exact copy strings (from 07-UI-SPEC §6.7):**
- Title: `"Reprocess this email?"`
- Description: `"All existing region extractions will be superseded and new ones generated. Your confirmed regions and their field data are never deleted — they remain accessible via the history view."`
- Cancel: `"Keep current data"`
- Action: `"Reprocess Email"`

---

### `apps/web/src/app/emails/[id]/_components/fields-panel.tsx` — new component

**Analog:** `apps/web/src/app/emails/[id]/_components/entities-list.tsx` (list row structure) + `nest-picker.tsx` (inline card pattern)

**Imports pattern** (copy from entities-list.tsx lines 1-18, plus Input):

```typescript
"use client";

import { Badge } from "@nauta/ui/badge";
import { Button } from "@nauta/ui/button";
import { Input } from "@nauta/ui/input";
import { Loader2 } from "lucide-react";
```

**Status badge reuse** — copy `getStatusBadge()` from entities-list.tsx lines 44-59 directly:

```typescript
function getStatusBadge(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  if (status === "rejected") return { variant: "outline", className: "line-through" };
  if (status === "superseded") return { variant: "secondary", className: "opacity-60" };
  if (status === "candidate") return { variant: "default" };
  return { variant: "secondary" };
}
```

**Extracting loading state pattern** (from 07-UI-SPEC §3.4):

```tsx
<div
  className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground"
  aria-busy="true"
  aria-label="Extracting fields…"
>
  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
  Extracting fields…
</div>
```

**Per-field confidence color logic:**

```typescript
// Confidence badge: below 0.5 → text-destructive; else → text-muted-foreground
const confidenceClass =
  score < 0.5 ? "text-destructive text-xs" : "text-muted-foreground text-xs";
const confidenceText = `${Math.round(score * 100)}%`;
```

**Props interface:**

```typescript
interface FieldsPanelProps {
  readonly phase: "extracting" | "reviewing" | "confirming" | "confirmed";
  readonly entityTypeLabel: string;
  readonly extractionRecordStatus: string | null;
  readonly confidenceScore: number | null;
  readonly fields: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly isRequired: boolean;
  }>;
  readonly extractedFields: Record<string, unknown>;
  readonly correctedFields: Record<string, unknown> | null;
  readonly confidenceBreakdown: Record<string, unknown> | null;
  readonly fieldValues: Record<string, string>;
  readonly onFieldChange: (key: string, value: string) => void;
  readonly onConfirm: () => void;
  readonly onDiscard: () => void;
}
```

---

### `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx` — extend with Autofill button

**Analog:** self — `apps/web/src/app/emails/[id]/_components/action-toolbar.tsx`

**Props extension** (add to `ActionToolbarProps` interface):

```typescript
// Add to ActionToolbarProps (lines 29-49):
readonly onAutofill?: (componentId: string) => void;
readonly autofillPickerOpen?: boolean;
readonly onAutofillPickerChange?: (open: boolean) => void;
// Entity types data for the picker (passed down from email-detail)
readonly entityTypes?: ReadonlyArray<{ slug: string; label: string; description: string | null }>;
readonly entityTypesLoading?: boolean;
```

**Button placement pattern** — insert after NestPicker block (after line 272), before contextLabel span. Copy Tooltip+Button idiom from lines 162-175:

```tsx
{/* Autofill Fields — only for candidate single selection */}
{single && status === "candidate" && onAutofill && (
  <EntityTypePicker
    open={autofillPickerOpen ?? false}
    onOpenChange={onAutofillPickerChange ?? (() => {})}
    onSelect={(slug) => onAutofill(single.id /* pass slug to parent */)}
  />
)}
{single && status === "pending" && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="sm" aria-label="Autofill Fields" disabled>
        ✦ Autofill Fields
      </Button>
    </TooltipTrigger>
    <TooltipContent>Accept the region first</TooltipContent>
  </Tooltip>
)}
```

**Disabled pattern for pending/rejected regions** — copy the disabled+tooltip wrapper from Redraw (lines 199-213).

---

### `apps/web/src/app/emails/[id]/_components/entities-list.tsx` — extend with fields panel slot

**Analog:** self — `apps/web/src/app/emails/[id]/_components/entities-list.tsx`

**Props extension** (add to `EntitiesListProps` interface at lines 61-81):

```typescript
// Add:
readonly autofillPhases?: Record<string, string>;        // componentId → AutofillPhase
readonly extractionResults?: Record<string, unknown>;    // componentId → ExtractionResult
readonly fieldValues?: Record<string, Record<string, string>>;
readonly entityTypeFieldsMap?: Record<string, ReadonlyArray<{ key: string; label: string; isRequired: boolean }>>;
readonly onFieldChange?: (componentId: string, key: string, value: string) => void;
readonly onConfirmFields?: (componentId: string) => void;
readonly onDiscardFields?: (componentId: string) => void;
```

**Inline panel insertion pattern** — inside the `visibleRegions.map()` at line 183, after the `<li>` element's `<button>`:

```tsx
{visibleRegions.map((component) => {
  const phase = autofillPhases?.[component.id];
  const shouldShowPanel = phase === "extracting" || phase === "reviewing" || phase === "confirming" || phase === "confirmed";
  return (
    <li key={component.id} role="listitem" className="flex flex-col">  {/* ← flex-col for panel below */}
      {/* ... existing button ... */}
      {shouldShowPanel && (
        <FieldsPanel
          phase={phase}
          {/* ... pass extracted data ... */}
        />
      )}
    </li>
  );
})}
```

Note: `<li>` className changes from `"flex items-center"` (line 194) to `"flex flex-col"` to allow vertical stacking.

---

### `apps/web/src/app/emails/[id]/_components/email-detail.tsx` — extend with autofill state

**Analog:** self — `apps/web/src/app/emails/[id]/_components/email-detail.tsx`

**Existing state hoisting pattern** (lines 78-105) — add autofill state alongside `edit`:

```typescript
// Phase 6 — region edit state machine
const edit = useRegionEdit({ emailId });

// Phase 7 — autofill state (or extract to useAutofill hook following useRegionEdit idiom)
const [autofillState, setAutofillState] = useState<Record<string, AutofillPhase>>({});
const [extractionResults, setExtractionResults] = useState<Record<string, ExtractionResult>>({});
const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>({});
const [reprocessDialogOpen, setReprocessDialogOpen] = useState<boolean>(false);
```

**Mutation hook idiom** — copy from `use-region-edit.ts` lines 78-135 (accept/reject mutations with `onSuccess: invalidate + toast + clear`, `onError: revert + toast`):

```typescript
// autofillComponent mutation — NO optimistic update (LLM result is server truth)
const autofillMutation = api.emails.autofillComponent.useMutation({
  onSuccess: (data, variables) => {
    const result = (data as { data: AutofillResultView }).data;
    setAutofillState((prev) => ({ ...prev, [variables.componentId]: "reviewing" }));
    setExtractionResults((prev) => ({ ...prev, [variables.componentId]: result }));
    setFieldValues((prev) => ({
      ...prev,
      [variables.componentId]: Object.fromEntries(
        Object.entries(result.extracted_fields).map(([k, v]) => [k, String(v ?? "")]),
      ),
    }));
  },
  onError: (_err, variables) => {
    setAutofillState((prev) => ({ ...prev, [variables.componentId]: "idle" }));
    toast.error("AI autofill is unavailable — model access is pending.", { duration: 6000 });
  },
});
```

**confirmComponent mutation — invalidate, no optimistic** (following redraw pattern lines 138-148):

```typescript
const confirmMutation = api.emails.confirmComponent.useMutation({
  onSuccess: async (_data, variables) => {
    await utils.emails.detail.invalidate({ id: emailId });
    setAutofillState((prev) => ({ ...prev, [variables.componentId]: "confirmed" }));
    toast.success("Fields confirmed");
  },
  onError: (_err, variables) => {
    setAutofillState((prev) => ({ ...prev, [variables.componentId]: "reviewing" }));
    toast.error("Could not confirm fields. Try again.");
  },
});
```

**Header extension pattern** (lines 317-336) — add Reprocess button after the `<Badge>`:

```tsx
<header className="mb-8 flex flex-wrap items-start gap-4">
  <Link href="/" ...>← Back to inbox</Link>
  <div className="flex flex-1 items-start justify-between gap-3">
    <h1 ref={h1Ref} ...>{subject}</h1>
    <div className="flex items-center gap-2">
      <Badge variant={parseStatusVariant(email.parseStatus)}>
        {email.parseStatus}
      </Badge>
      <Button
        variant="outline"
        size="sm"
        aria-label="Reprocess this email"
        onClick={() => setReprocessDialogOpen(true)}
      >
        Reprocess Email
      </Button>
    </div>
  </div>
</header>
```

---

## Shared Patterns

### Proxy Fetch + Error Handling
**Source:** `packages/api-client/src/router/emails/mutations.ts` lines 22-55
**Apply to:** All three new tRPC mutations (`autofillComponent`, `confirmComponent`, `reprocessEmail`)
```typescript
function getListenerConfig(): { url: string; apiKey: string } { ... }
async function parseErrorDetail(res: Response, fallback: string): Promise<string> { ... }
// if (!res.ok) { throw new Error(await parseErrorDetail(res, "mutationName failed")); }
```

### Toast + Invalidate Pattern
**Source:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` lines 94-105
**Apply to:** All new mutation hooks (autofill, confirm, reprocess)
```typescript
onSuccess: async () => {
  await utils.emails.detail.invalidate({ id: emailId });
  toast.success("...");
},
onError: (_err, _vars, context) => {
  // revert optimistic if needed; else just toast
  toast.error("...");
},
```

### AlertDialog Pattern (non-destructive variant)
**Source:** `apps/web/src/app/emails/[id]/_components/reject-dialog.tsx`
**Apply to:** `reprocess-dialog.tsx`
- Copy full structure; change `buttonVariants({ variant: "destructive" })` to `buttonVariants({ variant: "default" })` for the action button.

### Popover Picker Pattern
**Source:** `apps/web/src/app/emails/[id]/_components/nest-picker.tsx`
**Apply to:** `entity-type-picker.tsx`
- Same `<Popover open onOpenChange>` + `<PopoverTrigger asChild>` + `<PopoverContent>` skeleton.
- Change `w-64` to `w-72`; add `role="listbox"` on the options container.

### getStatusBadge Utility
**Source:** `apps/web/src/app/emails/[id]/_components/entities-list.tsx` lines 44-59
**Apply to:** `fields-panel.tsx` (for the extraction record status chip in panel header)
- Import or inline — do NOT re-implement with different logic.

### Zod Input Validation
**Source:** `packages/api-client/src/router/emails/mutations.ts` lines 67-68
**Apply to:** All three new tRPC mutations
```typescript
.input(z.object({ componentId: z.string().uuid(), ... }))
```

---

## FastAPI Backend Contracts (read-only reference)

### POST /v1/components/{id}/autofill
**Source:** `apps/email-listener/app/presentation/api/v1/components.py` lines 59-67, 138-167
- Request body: `{ entity_type_slug: str }`
- Response: `ApiResponse<AutofillResultView>` → `{ data: { extracted_fields, confidence_score, confidence_breakdown } }`
- Errors: `ValueError` → `404` detail `"Component not found"`; Bedrock unavailable → `500`/`502`

### POST /v1/components/{id}/confirm
**Source:** `apps/email-listener/app/presentation/api/v1/components.py` lines 69-73, 170-192
- Request body: `{ corrected_fields: dict | null }`
- Response: `ApiResponse<ConfirmAck>` → `{ data: { component_id, status: "confirmed" } }`

### POST /v1/emails/{id}/reprocess
**Source:** `apps/email-listener/app/presentation/api/v1/emails.py` lines 175-194
- Request body: `{}` (empty)
- Response: `ApiResponse<ReprocessAck>` → `{ data: { email_id, superseded_components } }`
- Any 2xx = success in tRPC proxy (return `res.json() as Promise<unknown>`)

---

## DB Schema Quick Reference

### ExtractionRecords fields needed for detail.ts extension
**Source:** `packages/db/src/schema/extractions.ts`

| Drizzle column | JS property | Type |
|---|---|---|
| `ExtractionRecords.extractedFields` | `extractedFields` | `jsonb` (already selected) |
| `ExtractionRecords.correctedFields` | `correctedFields` | `jsonb`, nullable — **add** |
| `ExtractionRecords.confidenceScore` | `confidenceScore` | `numeric(5,4)` (already selected) |
| `ExtractionRecords.confidenceBreakdown` | `confidenceBreakdown` | `jsonb`, nullable — **add** |
| `ExtractionRecords.status` | `extractionRecordStatus` | `text enum` — **add** |

### EntityTypeFields columns for entity-types router
**Source:** `packages/db/src/schema/entity-types.ts`

| Drizzle column | Maps to output key |
|---|---|
| `EntityTypeFields.slug` | `key` (machine field key) |
| `EntityTypeFields.label` | `label` |
| `EntityTypeFields.fieldType` | `dataType` |
| `EntityTypeFields.isRequired` | `isRequired` |
| `EntityTypeFields.sortOrder` | (for ORDER BY, not returned) |

---

## Test Patterns

### vitest setup
**Source:** `packages/api-client/src/geometry.test.ts`
**Apply to:** new tRPC router tests (entity-types.ts, mutations autofill/confirm/reprocess)

```typescript
import { describe, expect, it } from "vitest";
// No __tests__ directory exists yet — create packages/api-client/src/router/__tests__/
// Mock fetch with vi.stubGlobal("fetch", vi.fn())
// Mock ctx.db with vi.fn() returning Drizzle-shaped arrays
```

**Testing idiom — immutability check** (lines 88-104 of geometry.test.ts):
```typescript
it("returns a new immutable object each call (does not mutate input)", () => {
  const result1 = fn(input);
  const result2 = fn(input);
  expect(result1).not.toBe(result2);
});
```

---

## No Analog Found

All files have strong analogs. No files require falling back to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `packages/api-client/src/`, `apps/web/src/app/emails/`, `apps/email-listener/app/presentation/api/v1/`, `packages/db/src/schema/`
**Files scanned:** 14
**Pattern extraction date:** 2026-06-12
