# Phase 5: Review UI — Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 14 new/modified files
**Analogs found:** 12 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/api-client/src/router/emails/detail.ts` | router | request-response | `packages/api-client/src/router/emails/index.ts` | exact |
| `packages/api-client/src/router/emails/index.ts` | router | request-response | self (extend) | exact |
| `packages/api-client/src/geometry.ts` | utility | transform | none in TS stack | no analog |
| `packages/api-client/src/geometry.test.ts` | test | transform | `examples/acme-os-dev/packages/api-client/__tests__/router/records.test.ts` | role-match |
| `apps/web/src/app/emails/[id]/page.tsx` | page | request-response | `apps/web/src/app/page.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | component | request-response | `apps/web/src/app/page.tsx` | exact |
| `apps/web/src/app/emails/[id]/_components/metadata-card.tsx` | component | request-response | `apps/web/src/app/page.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/body-card.tsx` | component | request-response | `apps/web/src/app/page.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/attachments-card.tsx` | component | request-response | `apps/web/src/app/page.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/entities-list.tsx` | component | event-driven | `apps/web/src/app/page.tsx` | role-match |
| `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` | component | event-driven | none in this repo | no analog |
| `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` | component | event-driven | none in this repo | no analog |
| `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` | component | event-driven | none in this repo | no analog |
| `apps/web/src/app/api/attachments/[id]/route.ts` | route | request-response | `apps/web/src/app/api/trpc/[trpc]/route.ts` | role-match |

---

## Pattern Assignments

### `packages/api-client/src/router/emails/detail.ts` (router, request-response)

**Analog:** `packages/api-client/src/router/emails/index.ts`

**Imports pattern** (lines 1–6):
```typescript
import { eq } from "drizzle-orm";
import { z } from "zod";

import { EmailAttachments, EmailComponents, Emails, EntityTypes, ExtractionRecords } from "@nauta/db/schema";

import { createTRPCRouter, publicProcedure } from "../../trpc";
```

**Core query pattern** (lines 13–62, `byId` as template):
```typescript
export const emailDetailRouter = createTRPCRouter({
  detail: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // 1. Fetch email row
      const emailRows = await ctx.db
        .select()
        .from(Emails)
        .where(eq(Emails.id, input.id))
        .limit(1);

      if (!emailRows[0]) return null;

      // 2. Fetch attachments
      const attachments = await ctx.db
        .select()
        .from(EmailAttachments)
        .where(eq(EmailAttachments.emailId, input.id));

      // 3. Fetch components with entity type join
      const components = await ctx.db
        .select({ /* columns */ })
        .from(EmailComponents)
        .leftJoin(ExtractionRecords, eq(ExtractionRecords.componentId, EmailComponents.id))
        .leftJoin(EntityTypes, eq(EntityTypes.id, ExtractionRecords.entityTypeId))
        .where(eq(EmailComponents.emailId, input.id));

      return { email: emailRows[0], attachments, components };
    }),
});
```

**No auth guard** — follows `publicProcedure` pattern throughout (lines 18, 52 in analog).

**Error handling pattern** — router-level: return `null` on not-found (not a thrown error); tRPC auto-propagates thrown errors as INTERNAL_SERVER_ERROR.

---

### `packages/api-client/src/router/emails/index.ts` (router, update only)

**Change:** Import and register `emailDetailRouter` into the merged `emailsRouter`.

**Registration pattern** from `packages/api-client/src/root.ts` (lines 1–6):
```typescript
// root.ts pattern — merge sub-routers with createTRPCRouter
import { emailsRouter } from "./router/emails";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  emails: emailsRouter,
});
```

Apply same merge at the emails router level:
```typescript
// emails/index.ts — extend with spread merge
import { emailDetailProcedures } from "./detail";

export const emailsRouter = createTRPCRouter({
  list: /* existing */,
  byId: /* existing */,
  ...emailDetailProcedures,   // detail, etc.
});
```

---

### `packages/api-client/src/geometry.ts` (utility, transform)

**No analog in this codebase.** Implement fresh per the spec.

**Contract from 05-UI-SPEC.md §5.6:**
```typescript
// Named export only; immutable inputs (ReadonlyArray)
export function polygonToRect(
  polygon: ReadonlyArray<readonly [number, number]>
): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { left, top, width: right - left, height: bottom - top };
}
```

Place in `packages/api-client/src/geometry.ts` and re-export from `packages/api-client/src/index.ts`.

---

### `packages/api-client/src/geometry.test.ts` (test, transform)

**Analog:** `examples/acme-os-dev/packages/api-client/__tests__/router/records.test.ts`

**Test idiom** (lines 1–9, 29–49):
```typescript
import { beforeEach, describe, expect, it } from "vitest";

// Pure function tests — no mock DB needed
describe("polygonToRect", () => {
  it("maps axis-aligned rectangle polygon to correct rect", () => {
    const polygon = [[0.1, 0.2], [0.5, 0.2], [0.5, 0.6], [0.1, 0.6]] as const;
    expect(polygonToRect(polygon)).toEqual({
      left: 0.1, top: 0.2, width: 0.4, height: 0.4,
    });
  });

  it("handles skewed (non-axis-aligned) polygon via min/max bounding box", () => { /* ... */ });
  it("handles single-point degenerate polygon (zero area)", () => { /* ... */ });
  it("handles full-page polygon [[0,0],[1,0],[1,1],[0,1]]", () => { /* ... */ });
  it("returns new immutable object each call", () => { /* ... */ });
});
```

**No mock DB required** — pure function. Use `vitest` directly; no `createMockDb` / `createMockContext` needed.

---

### `apps/web/src/app/emails/[id]/page.tsx` (page, request-response)

**Analog:** `apps/web/src/app/page.tsx`

**Imports pattern** (lines 1–13, analog):
```typescript
"use client";   // NOTE: detail page uses Server Component shell + Client component

import { Badge } from "@nauta/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@nauta/ui/card";
import { Skeleton } from "@nauta/ui/skeleton";
import { api } from "~/trpc/react";
```

**Page shell pattern** — the existing `page.tsx` is a single `"use client"` file. For the detail page, use a thin server component shell (`page.tsx`) that renders a client component (`email-detail.tsx`):
```typescript
// apps/web/src/app/emails/[id]/page.tsx  — server component (no "use client")
import type { Metadata } from "next";
import { EmailDetail } from "./_components/email-detail";

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  return { title: `Loading… — Nauta` };  // detail overwrites via useEffect if needed
}

export default function EmailDetailPage({ params }: { params: { id: string } }) {
  return <EmailDetail emailId={params.id} />;
}
```

**Layout idiom** from analog (line 33):
```tsx
<main className="mx-auto max-w-7xl px-6 py-12">
  {/* wider than inbox's max-w-3xl per UI spec §5.1 */}
</main>
```

---

### `apps/web/src/app/emails/[id]/_components/email-detail.tsx` (component, request-response)

**Analog:** `apps/web/src/app/page.tsx` (full file — all patterns apply)

**"use client" + tRPC hook pattern** (lines 1–31 of analog):
```typescript
"use client";

import { api } from "~/trpc/react";

export function EmailDetail({ emailId }: { emailId: string }) {
  const { data, isLoading, isError, error } = api.emails.detail.useQuery({ id: emailId });
  // ...
}
```

**Loading skeleton pattern** (lines 41–47 of analog):
```tsx
{isLoading && (
  <div className="space-y-3" aria-busy="true" aria-label="Loading…">
    <Skeleton className="h-28 w-full rounded-xl" />
    <Skeleton className="h-28 w-full rounded-xl" />
    <Skeleton className="h-28 w-full rounded-xl" />
  </div>
)}
```

**Error card pattern** (lines 49–57 of analog):
```tsx
{isError && (
  <Card className="border-destructive" role="alert">
    <CardHeader>
      <CardTitle className="text-destructive text-base">
        Failed to load email
      </CardTitle>
      <CardDescription>{error.message}</CardDescription>
    </CardHeader>
  </Card>
)}
```

**parseStatusVariant helper** (lines 18–23 of analog — copy verbatim):
```typescript
const parseStatusVariant = (
  status: string,
): "default" | "secondary" | "destructive" => {
  if (status === "parsed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
};
```

**fmt helper** (line 15–16 of analog — copy verbatim):
```typescript
const fmt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString() : "—";
```

**State hoisting pattern** — all state listed in UI-SPEC §8 lives here (`useState`). Pass down as props to child components; no global store.

---

### `apps/web/src/app/emails/[id]/_components/metadata-card.tsx` (component, request-response)

**Analog:** `apps/web/src/app/page.tsx` (Card + CardHeader + CardDescription pattern, lines 71–99)

**Card pattern**:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@nauta/ui/card";
import { Badge } from "@nauta/ui/badge";

// Use <dl>/<dt>/<dd> for metadata rows (accessibility contract §12)
// Badge variant="outline" for importerId (per spec §5.2)
// parseStatusVariant() for parse_status Badge (reuse from email-detail.tsx)
```

**Sender display** (lines 83–86 of analog):
```tsx
{email.senderName
  ? `${email.senderName} <${email.senderAddress}>`
  : email.senderAddress}
```

---

### `apps/web/src/app/emails/[id]/_components/body-card.tsx` (component, request-response)

**Analog:** `apps/web/src/app/page.tsx` (Card + CardContent pattern)

**Tabs import** (from @nauta/ui per spec §6):
```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@nauta/ui/tabs";
import { ScrollArea } from "@nauta/ui/scroll-area";
```

**HTML sanitization** — DOMPurify is browser-only; must guard with `typeof window !== "undefined"` check or use dynamic import. Pattern:
```typescript
// Only sanitize on client side; DOMPurify requires DOM
const sanitized = typeof window !== "undefined"
  ? DOMPurify.sanitize(bodyHtml)
  : "";
```

---

### `apps/web/src/app/emails/[id]/_components/attachments-card.tsx` (component, request-response)

**Analog:** `apps/web/src/app/page.tsx` (list rendering pattern, lines 68–103)

**List pattern**:
```tsx
{attachments.map((att) => (
  <div key={att.id} className="flex items-center gap-3">
    {/* file type glyph, filename, badge, View/Download button */}
  </div>
))}
```

**Button import** (per spec §6):
```typescript
import { Button } from "@nauta/ui/button";
```

**Signed URL fetch** — call `GET /api/attachments/[id]` via `fetch()` on button click; cache result in `signedUrls` state map (keyed by attachmentId) in parent `email-detail.tsx`.

---

### `apps/web/src/app/emails/[id]/_components/entities-list.tsx` (component, event-driven)

**Analog:** `apps/web/src/app/page.tsx` (list + empty state pattern)

**Empty state pattern** (lines 60–65 of analog):
```tsx
{components.length === 0 && (
  <Card>
    <CardContent className="text-muted-foreground py-8 text-center text-sm space-y-2">
      <p className="text-foreground font-semibold">No detected regions yet</p>
      <p>Document segmentation is pending. Regions will appear here once processing completes.</p>
    </CardContent>
  </Card>
)}
```

**Interaction:** Each item is a `<button>` (full-width, `text-left`) within `role="list"`. Calls `onSelectComponent(id, pageIndex, attachmentId)` prop callback when clicked — the parent (`email-detail.tsx`) owns state updates.

**ScrollArea** wraps the list (per spec §5.7):
```typescript
import { ScrollArea } from "@nauta/ui/scroll-area";
```

---

### `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` (component, event-driven)

**No close analog in this repo.** Use the structural pattern from 05-UI-SPEC.md §5.5 directly.

**Key imports**:
```typescript
"use client";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@nauta/ui/button";
import { Switch } from "@nauta/ui/switch";
```

**pdfjs worker setup** (required by react-pdf v9 in Next.js):
```typescript
import { pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
```
Note: This must be at module level; place in the file that imports `react-pdf` first (likely `pdf-preview-pane.tsx`).

**State** (local per spec §8): `currentPage`, `numPages`, `scale`, `pageSize`, `showOverlays` — all `useState` in this component; `activeComponentId` comes from parent as prop.

---

### `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` (component, event-driven)

**No close analog.** Implement per 05-UI-SPEC.md §5.6 spec exactly.

**Import** (geometry utility from api-client package):
```typescript
import { polygonToRect } from "@nauta/api-client";
```

**Position style pattern** (from spec):
```tsx
const rect = polygonToRect(component.location.polygon);
<div
  style={{
    position: "absolute",
    left:   rect.left   * pageSize.width,
    top:    rect.top    * pageSize.height,
    width:  rect.width  * pageSize.width,
    height: rect.height * pageSize.height,
  }}
  className="border-2 border-primary/60 bg-primary/10 rounded-sm
             hover:border-primary hover:bg-primary/20 transition-colors"
/>
```

---

### `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` (component, event-driven)

**No close analog.** Thin wrapper — filters `components` to those matching `currentPage - 1` and `source_type === "region"`, renders `<RegionOverlayBox>` for each. Pattern:
```tsx
<div
  className="absolute inset-0 pointer-events-none"
  style={{ width: pageSize.width, height: pageSize.height }}
  role="group"
  aria-label="Detected region overlays"
>
  {overlays.map((c) => <RegionOverlayBox key={c.id} ... />)}
</div>
```

---

### `apps/web/src/app/api/attachments/[id]/route.ts` (route handler, request-response)

**Analog:** `apps/web/src/app/api/trpc/[trpc]/route.ts`

**Route handler idiom** (lines 1–17 of analog):
```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ...
  return NextResponse.json({ url: signedUrl });
}
```

**Supabase service-role pattern** — `@supabase/supabase-js` is NOT yet in `apps/web/package.json` or any TS package. It must be added as a new dependency. Secret handling pattern from CLAUDE.md:
```typescript
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const { data, error } = await supabase.storage
  .from("email-attachments")
  .createSignedUrl(storageKey, 60);
```

**Error handling** (server-side log + user-friendly response):
```typescript
// Log detail server-side only; return friendly message to browser
if (error) {
  console.error("[attachments/[id]] Storage error:", error);
  return NextResponse.json(
    { error: "Failed to generate download link" },
    { status: 500 }
  );
}
```

The `console.error` here is intentional server-side logging (acceptable per CLAUDE.md: "Log detailed errors server-side"). Do not use `console.log`.

**Attachment row lookup** — must query the DB to get `storageKey` from the attachment id. Use Drizzle directly (same pattern as `packages/api-client/src/trpc.ts` line 15: `import { db } from "@nauta/db/client"`):
```typescript
import { db } from "@nauta/db/client";
import { EmailAttachments } from "@nauta/db/schema";
import { eq } from "drizzle-orm";

const rows = await db
  .select({ storageKey: EmailAttachments.storageKey })
  .from(EmailAttachments)
  .where(eq(EmailAttachments.id, params.id))
  .limit(1);
```

---

## Shared Patterns

### tRPC Client Usage
**Source:** `apps/web/src/trpc/react.tsx` line 24
**Apply to:** All `_components/*.tsx` files that fetch data
```typescript
import { api } from "~/trpc/react";

const { data, isLoading, isError, error } = api.emails.detail.useQuery({ id: emailId });
```

### @nauta/ui Import Convention
**Source:** `apps/web/src/app/page.tsx` lines 3–11
**Apply to:** All new component files
```typescript
// Each shadcn component from its own path (not barrel)
import { Badge } from "@nauta/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@nauta/ui/card";
import { Skeleton } from "@nauta/ui/skeleton";
import { Button } from "@nauta/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@nauta/ui/tabs";
import { ScrollArea } from "@nauta/ui/scroll-area";
import { Switch } from "@nauta/ui/switch";
import { Separator } from "@nauta/ui/separator";
import { Tooltip } from "@nauta/ui/tooltip";
```

### Error Card Pattern
**Source:** `apps/web/src/app/page.tsx` lines 49–58
**Apply to:** All components that can fail to load
```tsx
<Card className="border-destructive" role="alert">
  <CardHeader>
    <CardTitle className="text-destructive text-base">{heading}</CardTitle>
    <CardDescription>{error.message}</CardDescription>
  </CardHeader>
</Card>
```

### Skeleton Loading Pattern
**Source:** `apps/web/src/app/page.tsx` lines 41–47
**Apply to:** All loading states in detail page
```tsx
<div className="space-y-3" aria-busy="true" aria-label="Loading…">
  <Skeleton className="h-28 w-full rounded-xl" />
  <Skeleton className="h-28 w-full rounded-xl" />
  <Skeleton className="h-28 w-full rounded-xl" />
</div>
```

### Drizzle Schema Import Convention
**Source:** `packages/api-client/src/router/emails/index.ts` line 4
**Apply to:** `detail.ts` router
```typescript
import { EmailAttachments, EmailComponents, Emails, EntityTypes, ExtractionRecords } from "@nauta/db/schema";
```

### Immutable State Updates
**Source:** CLAUDE.md global rules
**Apply to:** All `useState` updates in components
```typescript
// Always spread; never mutate
setSignedUrls((prev) => ({ ...prev, [attachmentId]: url }));
```

### Named Exports Only
**Source:** CLAUDE.md global rules
**Apply to:** All new files
```typescript
// CORRECT
export function polygonToRect(...) { ... }
export function EmailDetail(...) { ... }

// WRONG — no default export except Next.js page.tsx (required by Next.js convention)
```
Exception: `page.tsx` files MUST use `export default` per Next.js App Router convention.

---

## Package Additions Required

These must be added to `apps/web/package.json` before implementation (no existing analogs):

| Package | Add to | Reason |
|---------|--------|--------|
| `react-pdf` `^9` | `dependencies` | PDF rendering |
| `pdfjs-dist` | `dependencies` | react-pdf peer dep |
| `dompurify` `^3` | `dependencies` | HTML sanitization |
| `@types/dompurify` `^3` | `devDependencies` | TypeScript types |
| `@supabase/supabase-js` | `dependencies` | Supabase Storage signed URL in route handler |

`next.config.mjs` already transpiles `@nauta/api-client` (line 14) so the new `geometry.ts` export is available without changes.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/api-client/src/geometry.ts` | utility | transform | No geometry/math utilities exist in the TS stack |
| `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx` | component | event-driven | No react-pdf usage exists in this repo |
| `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx` | component | event-driven | No overlay/canvas interaction components exist |
| `apps/web/src/app/emails/[id]/_components/overlay-layer.tsx` | component | event-driven | No overlay/canvas interaction components exist |

For these, use 05-UI-SPEC.md §5.5–5.6 structural patterns and react-pdf v9 docs directly.

---

## Metadata

**Analog search scope:** `packages/api-client/src/`, `packages/db/src/schema/`, `apps/web/src/`, `examples/acme-os-dev/packages/api-client/`
**Files scanned:** 18 source files
**Pattern extraction date:** 2026-06-12
