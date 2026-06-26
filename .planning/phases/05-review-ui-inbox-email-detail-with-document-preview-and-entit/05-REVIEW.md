---
phase: 05-review-ui-inbox-email-detail-with-document-preview-and-entit
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - apps/web/src/app/api/attachments/[id]/route.ts
  - apps/web/src/app/emails/[id]/_components/attachments-card.tsx
  - apps/web/src/app/emails/[id]/_components/body-card.tsx
  - apps/web/src/app/emails/[id]/_components/email-detail.tsx
  - apps/web/src/app/emails/[id]/_components/entities-list.tsx
  - apps/web/src/app/emails/[id]/_components/metadata-card.tsx
  - apps/web/src/app/emails/[id]/_components/overlay-layer.tsx
  - apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx
  - apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx
  - apps/web/src/app/emails/[id]/page.tsx
  - apps/web/src/app/page.tsx
  - packages/api-client/src/geometry.ts
  - packages/api-client/src/geometry.test.ts
  - packages/api-client/src/index.ts
  - packages/api-client/src/router/emails/detail.ts
  - packages/api-client/src/router/emails/index.ts
  - packages/api-client/vitest.config.ts
  - packages/api-client/package.json
  - packages/db/src/client.ts
  - packages/db/src/schema/enums.ts
  - packages/db/migrations/0012_component_source_type_region.sql
  - apps/web/package.json
  - .env.example
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: fixed
fixed_at: 2026-06-12T17:02:00Z
fixes:
  CR-01: "defer DOMPurify to useEffect; HTML tab disabled until sanitized"
  CR-02: "guard empty polygon in polygonToRect; tighten getPolygon length check"
  CR-03: "exclude superseded extraction records from components leftJoin"
  CR-04: "throw clear Error when DB URL missing at runtime; preserve build-time skip"
  WR-01: "SignedUrlEntry with expiresAt; re-fetch when TTL expires"
  WR-02: "replace error.message with friendly string; log to console.error"
  WR-03: "CardTitle in loadError branch corrected to PDF Preview"
  WR-04: "PdfPreviewPane accepts controlled currentPage + onPageChange props"
  WR-05: "clamp polygon coords to [0,1] before bounding-box computation"
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This phase delivers the email-detail UI with PDF preview and region overlay functionality. The implementation covers: a server-side Route Handler for signed attachment URLs, tRPC procedures for `detail`/`list`/`byId`, DOMPurify-based HTML sanitization, `react-pdf` integration, polygon-to-rect geometry, and a DB client with build-time env-skip logic.

Key concerns in severity order:

1. **XSS via SSR race** — `body-card.tsx` calls `DOMPurify.sanitize` client-side but the HTML is rendered with `dangerouslySetInnerHTML`; the `typeof window !== "undefined"` guard produces an empty string on SSR and the real sanitized HTML on hydration — but the _initial_ server-rendered HTML string is written to the DOM without any sanitization because `safeHtml` is computed as `""` server-side while `bodyHtml` is still passed to the `hasHtml` gating condition, meaning the HTML tab is _enabled_ and rendered as an empty div on SSR — the real concern is that if Next.js ever moves that component to partial pre-rendering or static export the raw `bodyHtml` prop could be used unsanitized. More critically, the `dangerouslySetInnerHTML` payload is the _computed_ `safeHtml` (`""`) on first render, so on SSR the HTML content is empty — but if the component is server-rendered to a string the empty string is safe. The structural gap is: the sanitization path is entirely skipped on the server, meaning any future server-side rendering of this component (e.g. moving the `"use client"` boundary) would silently bypass DOMPurify.

2. **Signed-URL caching race** — The 60-second TTL is shorter than a typical user dwell time. The client caches URLs indefinitely in React state; after 60 seconds a cached URL will return 403 from Supabase Storage. No expiry tracking or re-fetch logic exists client-side.

3. **`polygonToRect` called with empty polygon crashes** — `Math.min(...[])` returns `Infinity` and `Math.max(...[])` returns `-Infinity`, so an empty polygon array produces `{ left: Infinity, top: -Infinity, width: -Infinity, height: -Infinity }`. The `hasPolygon` guard in `overlay-layer.tsx` checks `poly.length > 0` but `getPolygon` in `region-overlay-box.tsx` only checks `Array.isArray(poly)` — not `poly.length > 0`. An empty array stored in JSONB would bypass the overlay-layer guard (which is correct) but reach `RegionOverlayBox.getPolygon` which returns the empty array to `polygonToRect`, producing `Infinity` CSS values.

4. **`detail` query fan-out on superseded extraction records** — The `leftJoin` on `ExtractionRecords` has no `status != 'superseded'` filter. A component that has been reprocessed multiple times will produce one result row per extraction record (all statuses), causing the same component to appear multiple times in the `components` array returned to the UI. The comment acknowledges "The join is 1:many in theory; in practice..." but the code does not enforce the constraint — it relies on a runtime assumption that is explicitly unsound.

5. **`db` handle silently undefined at runtime** — `packages/db/src/client.ts` casts `undefined` to the `ReturnType<typeof drizzle>` type when `connectionUrl` is falsy. At runtime this means `ctx.db.select(...)` throws a `TypeError: Cannot read properties of undefined` with no actionable error message if the env var is absent outside of the known skip conditions. The NEXT_PHASE check only covers `phase-production-build`; it does not cover `phase-export` or other Next.js phases.

6. **`error.message` leaked to UI in error cards** — `email-detail.tsx:137` and `page.tsx:57` render `{error.message}` directly in `CardDescription`. tRPC errors can carry internal details (SQL error text, schema names) that are not suitable for end-user display.

---

## Critical Issues

### CR-01: XSS — DOMPurify skipped entirely on server render; future SSR regression risk

**File:** `apps/web/src/app/emails/[id]/_components/body-card.tsx:28-31`
**Issue:** `safeHtml` is computed as `""` whenever `typeof window === "undefined"` (SSR). On first render the `dangerouslySetInnerHTML` payload is always `""`, which is safe today because Next.js hydrates the client immediately. However, the guard also means that if this component is ever server-rendered to a static string (e.g. partial pre-rendering, `generateStaticParams`, ISR, or removing `"use client"`) the sanitized output will be empty — but if a developer removes the `typeof window` guard for SSR support they would get raw `bodyHtml` passed to `dangerouslySetInnerHTML` without ever passing through DOMPurify. The correct pattern is to use `isomorphic-dompurify` or a server-side sanitizer so the pipeline is always active, or to add a Zod/validation step that strips HTML at the API boundary before it reaches the component.

**Fix:**
```typescript
// Option A: use isomorphic-dompurify (handles both SSR and client)
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

function sanitize(html: string): string {
  if (typeof window !== "undefined") {
    return createDOMPurify(window).sanitize(html);
  }
  // SSR path: use a JSDOM window
  const { window: ssrWindow } = new JSDOM("");
  return createDOMPurify(ssrWindow as unknown as Window).sanitize(html);
}

// Option B (simpler): sanitize the HTML at the tRPC boundary using
// a server-side library such as `sanitize-html`, so the prop arriving
// at <BodyCard> is already clean and dangerouslySetInnerHTML is safe
// regardless of render environment.
```

---

### CR-02: `polygonToRect` called with empty-array polygon produces Infinity CSS values

**File:** `apps/web/src/app/emails/[id]/_components/region-overlay-box.tsx:42-54` and `packages/api-client/src/geometry.ts:24-32`
**Issue:** `getPolygon` in `region-overlay-box.tsx` returns an empty array if `(location as ComponentLocation).polygon` is `[]`. The `hasPolygon` guard in `overlay-layer.tsx` (line 48) correctly filters `poly.length > 0`, but `RegionOverlayBox` is also callable directly (it does a `if (!polygon) return null` guard — but an empty array is truthy). If `polygon` is `[]`, `polygonToRect([])` computes `Math.min(...[]) = Infinity` and `Math.max(...[]) = -Infinity`, producing `{ left: Infinity, top: Infinity, width: -Infinity, height: -Infinity }` which are applied as inline `style` — React does not sanitize these values, resulting in a broken or offscreen overlay box.

**Fix:**
```typescript
// geometry.ts — add empty-polygon guard
export function polygonToRect(
  polygon: ReadonlyArray<readonly [number, number]>,
): { readonly left: number; readonly top: number; readonly width: number; readonly height: number } {
  if (polygon.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  // ... existing implementation
}

// region-overlay-box.tsx — tighten getPolygon
function getPolygon(
  location: unknown,
): ReadonlyArray<readonly [number, number]> | null {
  if (
    location !== null &&
    typeof location === "object" &&
    "polygon" in location &&
    Array.isArray((location as ComponentLocation).polygon) &&
    (location as ComponentLocation).polygon!.length > 0  // <-- add length check
  ) {
    return (location as ComponentLocation).polygon ?? null;
  }
  return null;
}
```

Also add a test case to `geometry.test.ts`:
```typescript
it("returns zero-size rect for empty polygon (no Infinity, no throw)", () => {
  expect(polygonToRect([])).toEqual({ left: 0, top: 0, width: 0, height: 0 });
});
```

---

### CR-03: `detail` query returns duplicate component rows for reprocessed components

**File:** `packages/api-client/src/router/emails/detail.ts:85-108`
**Issue:** The `leftJoin` on `ExtractionRecords` has no filter on `ExtractionRecords.status`. The schema explicitly supports `status = "superseded"` records (D-16 versioned reprocessing). A component reprocessed N times will have N extraction_records rows, producing N result rows in the `components` array. This causes:
1. The same region to render N overlay boxes on the PDF (stacked, visually incorrect).
2. The same component to appear N times in the `EntitiesList`.
3. `handleSelectComponent` being called with the same `componentId` from multiple list items.

The comment at line 83 says "no dedup/ranking needed yet" but the 1:many assumption is already violated by the superseded-record design.

**Fix:**
```typescript
import { and, eq, ne } from "drizzle-orm";

const components = await ctx.db
  .select({ ... })
  .from(EmailComponents)
  .leftJoin(
    ExtractionRecords,
    and(
      eq(ExtractionRecords.componentId, EmailComponents.id),
      ne(ExtractionRecords.status, "superseded"),   // <-- exclude superseded
    ),
  )
  .leftJoin(
    EntityTypes,
    eq(EntityTypes.id, ExtractionRecords.entityTypeId),
  )
  .where(eq(EmailComponents.emailId, input.id));
```

---

### CR-04: Silent `undefined` DB handle crashes at runtime with uninformative error

**File:** `packages/db/src/client.ts:38-45`
**Issue:** When `connectionUrl` is falsy (env var missing at actual server runtime), `db` is cast to `ReturnType<typeof drizzle>` via `undefined as unknown as ...`. Any tRPC procedure that calls `ctx.db.select(...)` will throw `TypeError: Cannot read properties of undefined (reading 'select')` — a crash with no diagnostic information. The `NEXT_PHASE` skip only covers `phase-production-build`; it misses `phase-export` and `phase-development` (when the env file is absent). A developer running `next dev` without `.env.local` will get a cryptic TypeError on their first request rather than a clear startup error.

**Fix:**
```typescript
// Fail fast with a clear error instead of a deferred TypeError
if (!connectionUrl) {
  // During a known build-time skip, db is legitimately unused — cast safely.
  // At runtime, throw immediately so the misconfiguration is obvious.
  const skipEnv =
    !!process.env.CI ||
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.NEXT_PHASE === "phase-production-build";

  if (!skipEnv) {
    throw new Error(
      "[packages/db] POSTGRES_URL_NON_POOLING and POSTGRES_URL are both unset. " +
      "Copy .env.example to .env.local and fill in your database credentials.",
    );
  }
}

const client = connectionUrl
  ? postgres(connectionUrl, { prepare: false })
  : (undefined as unknown as postgres.Sql);

export const db = client
  ? drizzle(client, { schema, logger: true })
  : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>);
```

---

## Warnings

### WR-01: Signed URL cache has no TTL — URLs expire after 60s while client holds them indefinitely

**File:** `apps/web/src/app/emails/[id]/_components/email-detail.tsx:58` and `apps/web/src/app/emails/[id]/_components/attachments-card.tsx:39-41`
**Issue:** Both `email-detail.tsx` (line 69: `if (signedUrls[activeAttachmentId]) return;`) and `attachments-card.tsx` (line 39: `if (signedUrls[att.id])`) treat a cached signed URL as permanently valid. Supabase Storage signed URLs expire after 60 seconds (TTL set in `route.ts:79`). A user who opens the page and then views a PDF more than 60 seconds later will get a 403 from react-pdf, triggering the `loadError` state — but the `signedUrls` entry remains in state, so clicking "View PDF" again will re-use the stale URL and fail again silently. The user has no recovery path short of a full page refresh.

**Fix:**
```typescript
// Store { url, expiresAt } instead of bare URL
interface SignedUrlEntry { url: string; expiresAt: number; }
type SignedUrlCache = Record<string, SignedUrlEntry>;

// When caching:
setSignedUrls((prev) => ({
  ...prev,
  [att.id]: { url: json.url!, expiresAt: Date.now() + 55_000 }, // 55s to be safe
}));

// When reading:
const cached = signedUrls[att.id];
const isValid = cached && cached.expiresAt > Date.now();
if (isValid) { window.open(cached.url, "_blank"); return; }
```

---

### WR-02: `error.message` from tRPC exposed directly in user-facing UI

**File:** `apps/web/src/app/emails/[id]/_components/email-detail.tsx:137` and `apps/web/src/app/page.tsx:57`
**Issue:** Both error states render `{error.message}` directly in a `CardDescription`. tRPC error messages may include internal details (Zod field paths, SQL error text from Drizzle, Postgres error codes). Per project security guidelines, detailed errors must be logged server-side; only friendly messages shown client-side.

**Fix:**
```tsx
// email-detail.tsx:137
<CardDescription>
  Unable to load this email. Please try refreshing the page.
</CardDescription>

// page.tsx:57
<CardDescription>
  Unable to load emails. Please try refreshing the page.
</CardDescription>
```
Log `error` to the console (or remove the display entirely) — it is already available in browser devtools for debugging.

---

### WR-03: `PdfPreviewPane` error state CardTitle says "Attachments" — wrong copy

**File:** `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx:107-108`
**Issue:** When `loadError` is true the rendered `CardTitle` reads "Attachments" (line 108). The component is the PDF preview pane — the title should be "PDF Preview" or "Preview failed". This is misleading and could confuse users who see a separate "Attachments" card above this one.

**Fix:**
```tsx
<CardTitle className="text-base">PDF Preview</CardTitle>
```

---

### WR-04: `PdfPreviewPane` local state diverges from `EmailDetail` parent state on attachment switch

**File:** `apps/web/src/app/emails/[id]/_components/email-detail.tsx:216-231` and `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx:64-71`
**Issue:** `PdfPreviewPane` owns `currentPage`, `numPages`, `scale`, and `pageSize` in its own local state. `EmailDetail` also owns `currentPage` (line 51 of email-detail.tsx) which it passes to `handleSelectComponent` via `setCurrentPage`. However, these are two _separate_ state values. When `handleSelectComponent` in `email-detail.tsx` calls `setCurrentPage(pageIndex + 1)` (line 100), it updates the parent's `currentPage` — which is not wired to `PdfPreviewPane` at all. `PdfPreviewPane` receives no `initialPage` prop and cannot be driven to a specific page from the parent. The click-to-jump-to-page behavior in `EntitiesList → onSelectComponent` is silently broken.

**Fix:** `PdfPreviewPane` should accept a controlled `currentPage` + `onPageChange` prop pair (or an `initialPage` prop), so that `handleSelectComponent` in `email-detail.tsx` can drive the displayed page.

```tsx
// email-detail.tsx — pass currentPage down
<PdfPreviewPane
  signedUrl={signedUrls[activeAttachmentId]}
  filename={...}
  components={components}
  activeComponentId={activeComponentId}
  setActiveComponentId={setActiveComponentId}
  currentPage={currentPage}          // <-- add
  onPageChange={setCurrentPage}      // <-- add
  onClose={() => setActiveAttachmentId(null)}
/>
```

---

### WR-05: `polygonToRect` does not clamp outputs to [0, 1] — out-of-bounds polygons produce offscreen overlays

**File:** `packages/api-client/src/geometry.ts:21-33`
**Issue:** The function docs state inputs are "in the range [0, 1]" but this is not enforced. JSONB data written by the Python pipeline could contain coordinates outside [0, 1] (e.g. due to rounding errors at page edges, or coordinates in pixel space rather than normalized space). Without clamping, `rect.left * pageSize.width` could produce a negative value or a value larger than the page width, causing overlays to render outside the PDF viewport. The CSS `overflow: hidden` on the parent container clips them visually but it also means legitimate near-edge boxes are silently truncated.

**Fix:**
```typescript
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function polygonToRect(...) {
  if (polygon.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);

  const left  = clamp(Math.min(...xs), 0, 1);
  const top   = clamp(Math.min(...ys), 0, 1);
  const right = clamp(Math.max(...xs), 0, 1);
  const bottom = clamp(Math.max(...ys), 0, 1);

  return { left, top, width: right - left, height: bottom - top };
}
```

---

## Info

### IN-01: `EmailDetailPage` does not validate the `id` path param before rendering `EmailDetail`

**File:** `apps/web/src/app/emails/[id]/page.tsx:14-21`
**Issue:** The page server component passes the raw `id` path param directly to `<EmailDetail emailId={id} />` without UUID validation. The tRPC `detail` procedure validates it via `z.string().uuid()` (correctly), so this is not a security issue — an invalid UUID returns a tRPC validation error. However, the UI then shows the generic "Failed to load email" error card for an invalid URL rather than a 404. A quick UUID check here would let the page return an HTTP 404 (`notFound()`) instead of a 200 with an error card.

**Fix:**
```typescript
import { notFound } from "next/navigation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EmailDetailPage({ params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  return <EmailDetail emailId={id} />;
}
```

---

### IN-02: `@nauta/api-client` package exports server-side tRPC internals accessible from client bundles

**File:** `packages/api-client/src/index.ts:1-23`
**Issue:** `index.ts` re-exports `appRouter`, `createCaller`, `createTRPCContext`, and `createCallerFactory`. All of these import `@nauta/db/client`, which imports `postgres` (a Node.js-only module). The `region-overlay-box.tsx` component imports `@nauta/api-client/geometry` (the scoped export), which is safe. However, if any client component ever imports from `@nauta/api-client` (the root export) rather than `@nauta/api-client/geometry`, it will pull in `postgres` and crash at runtime. The package has no `"browser"` export condition or `"server-only"` guard on the root export.

**Fix:** Add `import "server-only"` at the top of `packages/api-client/src/index.ts` (or `src/trpc.ts`) to produce a build-time error if a client component ever imports the root entry point:
```typescript
// packages/api-client/src/index.ts
import "server-only";
// ...rest of exports
```

---

### IN-03: `react-pdf` worker configured via module-level side effect in a `"use client"` file

**File:** `apps/web/src/app/emails/[id]/_components/pdf-preview-pane.tsx:22-25`
**Issue:** The `pdfjs.GlobalWorkerOptions.workerSrc` assignment runs at module evaluation time. In Next.js with React Server Components, module-level code in a `"use client"` file still evaluates during the server-side module graph walk (for tree-shaking). The `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` call may produce an incorrect URL in the SSR context (`import.meta.url` resolves to a file:// path rather than a browser URL). This can cause the pdf.js worker to fail to load in production builds. The standard fix is to lazy-initialize the worker URL inside a `useEffect` or to use the `next/dynamic` import with `ssr: false` for the entire `PdfPreviewPane`.

**Fix:**
```typescript
// Inside PdfPreviewPane component, before the first render:
useEffect(() => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}, []);
```

---

_Reviewed: 2026-06-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
