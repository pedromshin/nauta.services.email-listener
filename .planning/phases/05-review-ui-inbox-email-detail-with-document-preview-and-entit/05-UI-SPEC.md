---
phase: 5
phase_name: "Review UI — inbox email detail with document preview and entity-region overlays"
status: draft
created: "2026-06-12"
sources:
  - 05-CONTEXT.md (authoritative — all decisions locked)
  - 04-RESEARCH.md §8 (EmailView/EmailComponentView shape)
  - apps/web/src/app/page.tsx (inbox idiom)
  - apps/web/src/app/globals.css (token values)
  - packages/ui/src (component inventory)
  - packages/api-client/src/router/emails/index.ts (tRPC pattern)
---

# UI-SPEC — Phase 5: Review UI

## 1. Design System State

**Tool:** @nauta/ui (shadcn/ui components) + Tailwind CSS v3  
**Token source:** `apps/web/src/app/globals.css` — CSS custom properties on `:root`  
**Preset:** shadcn with custom primary (`hsl(164 39% 22%)` — dark teal-green)  
**New dependencies required (not yet in package.json):**

| Package | Version (min) | Purpose |
|---------|--------------|---------|
| `react-pdf` | ^9 | In-browser PDF rendering with page geometry access |
| `pdfjs-dist` | peer of react-pdf | PDF.js worker |
| `dompurify` | ^3 | Sanitize email HTML body before render |
| `@types/dompurify` | ^3 | TypeScript types |

No new shadcn components required beyond the existing inventory.  
No third-party registries. Registry safety gate: not applicable.

---

## 2. Color Tokens (locked — do NOT invent new values)

All values from `globals.css :root`. Use semantic token names, never raw HSL.

| Token | Light value | Purpose in Phase 5 |
|-------|------------|---------------------|
| `bg-background` | hsl(0 0% 100%) | Page background (60% dominant) |
| `bg-card` | hsl(0 0% 100%) | Card surfaces — email detail, entity list |
| `bg-muted` | hsl(0 0% 96.1%) | Secondary surfaces — metadata rows, skeleton base, text-tab inactive (30%) |
| `text-foreground` | hsl(0 0% 3.9%) | Primary text |
| `text-muted-foreground` | hsl(0 0% 45.1%) | Secondary text — metadata labels, timestamps |
| `bg-primary` | hsl(164 39% 22%) | Accent (10%) — active overlay box border + fill tint |
| `text-primary-foreground` | hsl(0 0% 98%) | Text on primary-coloured overlay labels |
| `bg-destructive` | hsl(0 84.2% 60.2%) | Error states — failed badge, error card border |
| `border-border` | hsl(0 0% 89.8%) | Card borders, separator lines |
| `bg-secondary` | hsl(0 0% 96.1%) | Badge backgrounds for secondary/pending status |

**Overlay-specific colour contract (implemented via Tailwind utilities):**

| State | Box border | Box fill | Label chip |
|-------|-----------|----------|------------|
| Default (unselected) | `border-primary/60` | `bg-primary/10` | `bg-primary text-primary-foreground` |
| Hover / keyboard-focused | `border-primary` | `bg-primary/20` | `bg-primary text-primary-foreground` |
| Synced-highlight (entity list item active) | `border-primary ring-2 ring-primary/40` | `bg-primary/20` | unchanged |

---

## 3. Typography (locked to existing page idiom)

| Role | Size class | Weight class | Line-height | Example use |
|------|-----------|-------------|-------------|-------------|
| Page heading | `text-2xl` (24px) | `font-semibold` (600) | `tracking-tight` | Page `<h1>` — matches inbox |
| Section heading | `text-base` (16px) | `font-semibold` (600) | default | CardTitle, section labels |
| Body / metadata | `text-sm` (14px) | `font-normal` (400) | `leading-relaxed` | Email body text, metadata values |
| Caption / badge | `text-xs` (12px) | `font-semibold` (600) | default | Badges, overlay label chips |

Exactly 4 sizes (`text-2xl`, `text-base`, `text-sm`, `text-xs`). Exactly 2 weights (`font-semibold`, `font-normal`). Consistent with existing inbox page.

---

## 4. Spacing Scale

8-point scale. All measurements are Tailwind spacing utilities (1 unit = 4px).

| Token | px | Use |
|-------|----|-----|
| `p-1` / `gap-1` | 4px | Overlay label chip internal padding |
| `p-2` / `gap-2` | 8px | Badge padding, metadata row gap, toolbar button gap |
| `p-3` / `gap-3` | 12px | Card body tight sections |
| `p-4` / `gap-4` | 16px | Card content default padding, entity list item |
| `p-6` | 24px | Page horizontal padding (`px-6`) — matches inbox |
| `py-12` | 48px top+bottom | Page vertical padding — matches inbox |
| `mb-8` | 32px | Header bottom margin — matches inbox |
| `space-y-3` | 12px | Card list vertical gap — matches inbox |

No exceptions needed. 44px touch targets are not required (desktop-only tool at this stage).

---

## 5. Layout Contracts

### 5.1 Route: `/emails/[id]` — Email Detail Page

**Responsive strategy:** Single-column on narrow viewports; two-panel side-by-side on `lg:` (≥1024px).

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to inbox          [subject]           [parseStatus] │  ← header row
├──────────────────────┬──────────────────────────────────────┤
│  LEFT PANEL          │  RIGHT PANEL                         │
│  max-w-sm lg:w-1/3   │  flex-1                              │
│                      │                                      │
│  ┌────────────────┐  │  ┌────────────────────────────────┐  │
│  │ Metadata Card  │  │  │ Attachments Card               │  │
│  │ From:          │  │  │  [filename.pdf] [content-type] │  │
│  │ To:            │  │  │  [filename2]                   │  │
│  │ Received:      │  │  └────────────────────────────────┘  │
│  │ Importer: [id] │  │                                      │
│  │ Status: [badge]│  │  ┌────────────────────────────────┐  │
│  └────────────────┘  │  │ Email Body Card                │  │
│                      │  │  [Text] [HTML]  ← tab toggle   │  │
│  ┌────────────────┐  │  │ ─────────────────────────────  │  │
│  │ Detected       │  │  │  body content area             │  │
│  │ Entities List  │  │  └────────────────────────────────┘  │
│  │  [entity chip] │  │                                      │
│  │  [entity chip] │  │                                      │
│  │  (empty state) │  │                                      │
│  └────────────────┘  │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

**Narrow (< lg):** Left panel stacks above right panel. PDF preview pane (when open) takes full width below the right-panel cards.

**Max content width:** `max-w-7xl mx-auto px-6` — wider than inbox's `max-w-3xl` to accommodate the two-panel layout.

### 5.2 Surface: Metadata Card

Implemented as `<Card>` with `<CardHeader>` + `<CardContent>`.

Fields (all `text-sm`):

| Label | Value source | Notes |
|-------|-------------|-------|
| From | `senderName <senderAddress>` | Same format as inbox list |
| To | `toAddresses.join(", ")` | Truncate at 2 recipients + "+N more" |
| Received | `receivedAt` formatted via `toLocaleString()` | Same `fmt()` helper as inbox |
| Importer | `importerId` | Rendered as `<Badge variant="outline">` — small, data-partitioning visibility |
| Status | `parseStatus` | `<Badge variant={parseStatusVariant(status)}>` — reuse inbox helper |

### 5.3 Surface: Email Body Card

`<Card>` with `<CardHeader>` + `<Tabs>` inside `<CardContent>`.

- Tab 1: "Plain text" (default active) — renders `bodyText` in `<pre className="whitespace-pre-wrap text-sm font-mono">` inside a `ScrollArea` (max height `h-64 overflow-auto`).
- Tab 2: "HTML" — renders `bodyHtml` sanitized via `DOMPurify.sanitize()` inside a `<div dangerouslySetInnerHTML>` inside the same `ScrollArea`. If `bodyHtml` is null/empty, the "HTML" tab is disabled with `disabled` prop and shows "No HTML version available" in muted text.
- The `<Tabs>` component from `@nauta/ui/tabs` provides the toggle.

### 5.4 Surface: Attachments Card

`<Card>` listing one row per attachment. Each row:

```
[PDF icon or file-type icon]  filename.ext     [content-type badge]  [View button]
```

- Icon: a simple `text-muted-foreground` text glyph (e.g. "PDF") in `text-xs font-mono` — no external icon library required; use Unicode or short string.
- `[View button]`: `<Button variant="outline" size="sm">View PDF</Button>` — clicking opens the PDF preview pane (see §5.5). Only enabled for `content_type === "application/pdf"`. For other types: button shows "Download" and triggers the signed-URL download.
- Attachment URL: obtained from a Next.js route handler `GET /api/attachments/[id]` that returns a short-lived Supabase Storage signed URL (60 s TTL) using the service-role key server-side. The tRPC query returns the attachment metadata; the actual bytes are fetched via this route handler.

### 5.5 Surface: PDF Preview Pane

Renders below the right-panel cards on narrow, or as a bottom section spanning full width on `lg:` (full-bleed within the content column). Activated when user clicks "View" on a PDF attachment.

```
┌──────────────────────────────────────────────────────────────┐
│  [← filename.pdf]          Page [1] / [3]   [−] [+]  [✕]   │  ← toolbar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │         react-pdf <Document> + <Page>                │   │
│  │         with overlay <div> positioned                │   │
│  │         absolutely on top of the page canvas         │   │
│  │                                                      │   │
│  │   ┌────────────┐  ← overlay box (source_type=region) │   │
│  │   │ ENTITY LABEL│                                    │   │
│  │   └────────────┘                                     │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Overlay toggle:** A `<Switch>` control labelled "Show regions" in the toolbar. Default state: ON. Toggling hides/shows all overlay boxes without re-rendering the PDF.

**Zoom:** Two buttons `[−]` `[+]` (step ±0.25, range 0.5–3.0). Default scale: 1.0. Scale state is local to the pane (`useState`). The rendered page pixel dimensions at each scale must be captured via react-pdf's `onRenderSuccess` callback to correctly size the overlay div.

**Page navigation:** `[← Prev]` `[Page N / Total]` `[Next →]` buttons. Disabled at boundaries. State: `currentPage: number` (1-indexed).

**Pane layout:**

```tsx
// Structural pattern (not executable — illustrates nesting)
<div className="relative w-fit mx-auto">
  {/* react-pdf Page renders the canvas */}
  <Document file={signedUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
    <Page
      pageNumber={currentPage}
      scale={scale}
      onRenderSuccess={({ width, height }) => setPageSize({ width, height })}
    />
  </Document>
  {/* Overlay layer — same pixel dimensions as the rendered page */}
  <div
    className="absolute inset-0 pointer-events-none"
    style={{ width: pageSize.width, height: pageSize.height }}
    aria-label="Detected region overlays"
  >
    {overlaysForCurrentPage.map((component) => (
      <RegionOverlayBox key={component.id} component={component} pageSize={pageSize} />
    ))}
  </div>
</div>
```

### 5.6 Surface: RegionOverlayBox

A single absolutely-positioned box per `email_components` row where:
- `source_type === "region"` (not page-level components)
- `location.page_index === currentPage - 1` (0-indexed in data, 1-indexed in UI)
- `location.polygon` is present (4-point 0–1 normalized, top-left origin)

**Geometry helper** (must be unit-tested):

```typescript
// polygonToRect: converts 4-corner 0-1 polygon to CSS position fractions
// Input: polygon = [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]  (top-left origin, 0-1)
// Output: { left, top, width, height } as fractions (multiply by pageSize px)
export function polygonToRect(
  polygon: ReadonlyArray<readonly [number, number]>
): { left: number; top: number; width: number; height: number } {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return { left, top, width: right - left, height: bottom - top };
}
```

**CSS positioning:**

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
             hover:border-primary hover:bg-primary/20 transition-colors
             focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
  role="region"
  aria-label={`${component.entityTypeLabel ?? component.extractionStatus} region`}
  tabIndex={0}
  data-component-id={component.id}
  onMouseEnter={() => setActiveComponentId(component.id)}
  onMouseLeave={() => setActiveComponentId(null)}
  onFocus={() => setActiveComponentId(component.id)}
  onBlur={() => setActiveComponentId(null)}
>
  {/* Label chip — top-left corner of the box */}
  <span className="absolute -top-5 left-0 text-xs font-semibold
                   bg-primary text-primary-foreground px-2 py-0.5 rounded-sm
                   whitespace-nowrap max-w-[160px] truncate pointer-events-none">
    {component.entityTypeLabel ?? component.extractionStatus}
  </span>
</div>
```

### 5.7 Surface: Detected Entities List (left panel)

`<Card>` with scrollable list of entity components for the current email (all attachments combined).

Each list item:

```
┌──────────────────────────────────────────┐
│  [entity label]  [extraction status]     │
│  Attachment: filename.pdf · Page 2       │  ← text-xs text-muted-foreground
└──────────────────────────────────────────┘
```

- Rendered as `<button>` elements (full-width, `text-left`) for keyboard navigation.
- Active/synced state: when `activeComponentId` matches, apply `bg-muted ring-2 ring-primary/30` to the list item.
- Clicking a list item: (1) sets `activeComponentId`, (2) navigates `currentPage` to that component's page, (3) if that attachment is not the currently viewed one, switches the preview to that attachment.
- Scroll: list items inside `<ScrollArea className="h-64">` if more than ~4 items.

---

## 6. Component Inventory

All components from `@nauta/ui` (existing inventory — no new installs required beyond react-pdf and dompurify).

| Component | Import path | Phase 5 usage |
|-----------|------------|---------------|
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | `@nauta/ui/card` | Metadata, body, attachments, entities, error states |
| `Badge` | `@nauta/ui/badge` | `parseStatus`, `importerId`, `contentType`, extraction status |
| `Skeleton` | `@nauta/ui/skeleton` | Loading states for all cards |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@nauta/ui/tabs` | Plain text / HTML body toggle |
| `ScrollArea` | `@nauta/ui/scroll-area` | Body text container, entities list |
| `Button` | `@nauta/ui/button` | "View" attachment, page nav (Prev/Next), zoom ±, close preview |
| `Switch` | `@nauta/ui/switch` | "Show regions" overlay toggle |
| `Separator` | `@nauta/ui/separator` | Dividers within cards |
| `Tooltip` | `@nauta/ui/tooltip` | Overlay box tooltip showing full extracted field values on hover |

**New packages (add to `apps/web/package.json`):**

| Package | Why |
|---------|-----|
| `react-pdf` | PDF rendering with geometry |
| `dompurify` | HTML sanitization |
| `@types/dompurify` | Types |

---

## 7. Interaction Contracts

### 7.1 Hover-Highlight Sync

Bidirectional sync between overlay boxes and the entities list via shared `activeComponentId: string | null` state (hoisted to the detail page component or a React context if nesting is deep).

| Trigger | Effect |
|---------|--------|
| Mouse enter / focus on overlay box | Highlight the matching entities list item (scroll into view if needed) |
| Mouse leave / blur on overlay box | Clear highlight |
| Click / Enter key on entities list item | Highlight the matching overlay box; navigate to that page |
| Mouse enter / focus on entities list item | Highlight the matching overlay box (if on current page) |

### 7.2 Page Navigation

- `[← Prev]` button: `currentPage > 1` → decrement. Disabled when `currentPage === 1`.
- `[Next →]` button: `currentPage < numPages` → increment. Disabled when `currentPage === numPages`.
- Navigating via the entities list automatically updates `currentPage`.
- Page indicator: `Page {currentPage} / {numPages}` in `text-sm text-muted-foreground`.

### 7.3 Overlay Toggle

`<Switch>` state: `showOverlays: boolean`, default `true`. When `false`, the overlay `<div>` container is `hidden` (CSS display none — not unmounted, to preserve sync state).

### 7.4 Zoom

- State: `scale: number`, default `1.0`, min `0.5`, max `3.0`, step `0.25`.
- `[−]` button: disabled when `scale <= 0.5`.
- `[+]` button: disabled when `scale >= 3.0`.
- On scale change: call `polygonToRect` again against new `pageSize` (react-pdf's `onRenderSuccess` fires again with new pixel dimensions).

### 7.5 Attachment Selection

- Clicking "View" on an attachment row: (1) fetch signed URL from `/api/attachments/[id]`, (2) set `activeAttachmentId`, (3) reset `currentPage` to 1, (4) open / scroll to preview pane.
- Clicking "View" on the currently active attachment: no-op (already rendered).
- Only one attachment previewed at a time.

### 7.6 Back Navigation

`← Back to inbox` link at top of page: Next.js `<Link href="/">`. `text-sm text-muted-foreground hover:text-foreground transition-colors`.

### 7.7 Keyboard Navigation Through Entities List

- Entity list items are `<button>` elements; standard Tab order.
- On Enter/Space: same as click (navigate + highlight).
- Arrow keys: not required in Phase 5 (standard Tab is sufficient for a read-only list).

---

## 8. State Management

All state is local to the `/emails/[id]` page component (no global store needed for Phase 5).

| State variable | Type | Initial | Scope |
|---------------|------|---------|-------|
| `activeAttachmentId` | `string \| null` | `null` | Page |
| `activeComponentId` | `string \| null` | `null` | Page |
| `currentPage` | `number` | `1` | Page |
| `numPages` | `number \| null` | `null` | Page |
| `scale` | `number` | `1.0` | Page |
| `pageSize` | `{ width: number; height: number } \| null` | `null` | Page |
| `showOverlays` | `boolean` | `true` | Page |
| `signedUrls` | `Record<string, string>` | `{}` | Page (keyed by attachmentId) |

---

## 9. Data Access Contract

### 9.1 tRPC Router Extensions (packages/api-client)

Extend `emailsRouter` with:

**`emails.detail`** — returns `EmailView` shape (§4 of 04-RESEARCH.md):

```typescript
// Input
{ id: string }  // email UUID

// Output shape
{
  email: {
    id: string;
    subject: string | null;
    senderName: string | null;
    senderAddress: string;
    toAddresses: string[];
    receivedAt: Date | null;
    bodyText: string | null;
    bodyHtml: string | null;
    parseStatus: string;
    importerId: string | null;
  };
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    storageKey: string;
    fileExt: string | null;
  }>;
  components: Array<{
    id: string;
    attachmentId: string | null;
    sourceType: string;
    contentText: string | null;
    extractionStatus: string;
    location: {
      page_index?: number;
      polygon?: ReadonlyArray<readonly [number, number]>;
      type: string;
    } | null;
    entityTypeLabel: string | null;
    entityTypeSlug: string | null;
    extractedFields: Record<string, unknown> | null;
    confidenceScore: number | null;
  }>;
}
```

D-18 compliance: no `DEFAULT_IMPORTER_ID` filter; query by email `id` only.

### 9.2 Signed URL Route Handler

`GET /api/attachments/[id]`

- Server-side only; uses `SUPABASE_SERVICE_ROLE_KEY` (never exposed to browser).
- Calls Supabase Storage `createSignedUrl(bucket="email-attachments", path=storageKey, expiresIn=60)`.
- Returns `{ url: string }` JSON.
- Error: 404 if attachment not found; 500 on storage error (logs detail server-side, returns `{ error: "Failed to generate download link" }`).

---

## 10. Loading States

Match existing inbox pattern exactly.

| Surface | Loading state |
|---------|--------------|
| Email detail (initial load) | 3 × `<Skeleton className="h-28 w-full rounded-xl" />` stacked with `space-y-3` (same as inbox) |
| Metadata card | `<Skeleton className="h-48 w-full rounded-xl" />` |
| Attachments card | `<Skeleton className="h-20 w-full rounded-xl" />` |
| Body card | `<Skeleton className="h-32 w-full rounded-xl" />` |
| Entities list | `<Skeleton className="h-24 w-full rounded-xl" />` |
| PDF preview | `<Skeleton className="h-96 w-full rounded-xl" />` while signed URL loads or PDF loads |
| PDF page change | No skeleton — react-pdf renders the new page in-place; previous page remains visible until replaced |

---

## 11. Copywriting Contract

All strings are exact. No variations.

### 11.1 Page Title (browser tab)

```
{subject} — Nauta
```

Fallback when subject is null:

```
(no subject) — Nauta
```

### 11.2 Back Link

```
← Back to inbox
```

### 11.3 Section Labels

| Section | Heading text |
|---------|-------------|
| Email detail page `<h1>` | `{subject}` or `(no subject)` |
| Metadata card | "Details" |
| Body card | "Message" |
| Attachments card | "Attachments" |
| Entities list card | "Detected Regions" |
| PDF preview toolbar | `{filename}` (truncated to 32 chars + "…" if longer) |

### 11.4 Empty States

**No emails found (if navigated to nonexistent id — 404-style):**

```
Card with CardContent:
"Email not found. It may have been deleted or the link is invalid."
```

**No attachments:**

```
Card with CardContent (text-muted-foreground, text-center, py-8):
"No attachments on this email."
```

**No detected regions (DEFAULT STATE — most common state until Bedrock unblocks):**

```
Card with CardContent (text-muted-foreground, text-sm, text-center, py-8, space-y-2):
  Line 1 (text-foreground font-semibold): "No detected regions yet"
  Line 2 (text-muted-foreground): "Document segmentation is pending. Regions will appear here once processing completes."
```

This is intentionally non-alarming copy. It must NOT read as an error. No error icon, no destructive color.

**No body text:**

```
Rendered in body tab area (text-muted-foreground, text-sm, italic):
"No message body."
```

**HTML tab when no bodyHtml:**

```
TabsTrigger disabled; content area shows:
"No HTML version available for this message."
```

### 11.5 Error States

**Email detail load failure:**

```html
<Card className="border-destructive">
  <CardHeader>
    <CardTitle className="text-destructive text-base">Failed to load email</CardTitle>
    <CardDescription>{error.message}</CardDescription>
  </CardHeader>
</Card>
```

**PDF load failure:**

```
Card with CardContent (text-center, py-8, space-y-2):
  Badge variant="destructive": "Preview failed"
  text-sm text-muted-foreground: "Could not load PDF preview. Try downloading the file directly."
  Button variant="outline" size="sm": "Download file"
```

**Signed URL fetch failure:**

```
text-sm text-destructive (inline, below attachment row):
"Could not generate download link. Please refresh and try again."
```

**Components/entities load failure:**

```
Card with CardContent:
  Badge variant="destructive" (inline): "Load failed"
  text-sm text-muted-foreground: "Region data could not be loaded."
```

### 11.6 Metadata Labels (display text for metadata card rows)

| Field | Label text |
|-------|-----------|
| Sender | "From" |
| Recipients | "To" |
| Received | "Received" |
| Importer | "Importer" |
| Parse status | "Status" |

### 11.7 Overlay Tooltip Content (on hover, via `<Tooltip>`)

When `extraction_record` is present with `extracted_fields`:

```
{entityTypeLabel}
{Object.entries(extractedFields).map(([k, v]) => `${k}: ${v}`).join("\n")}
```

When no extraction record yet:

```
{entityTypeLabel ?? extractionStatus}
Awaiting extraction
```

### 11.8 PDF Toolbar Labels

| Element | Text |
|---------|------|
| Previous page button | "← Prev" |
| Next page button | "Next →" |
| Page indicator | "Page {n} / {total}" |
| Zoom out button | "−" (aria-label: "Zoom out") |
| Zoom in button | "+" (aria-label: "Zoom in") |
| Overlay toggle label | "Show regions" |
| Close preview button | "✕" (aria-label: "Close preview") |

---

## 12. Accessibility Contracts

| Element | Contract |
|---------|----------|
| Overlay container div | `role="group"` `aria-label="Detected region overlays"` |
| Individual overlay box | `role="region"` `aria-label="{entityTypeLabel} region"` `tabIndex={0}` |
| Entities list | `role="list"` with each item as `role="listitem"` containing a `<button>` |
| Active entity item | `aria-pressed="true"` on the `<button>` when it is the activeComponentId |
| Overlay toggle Switch | `aria-label="Show region overlays"` |
| PDF canvas region | `aria-label="PDF preview — {filename}, page {currentPage} of {numPages}"` |
| Back link | Standard `<Link>` — no additional aria needed |
| Metadata card rows | `<dl>` / `<dt>` / `<dd>` markup for definition list semantics |
| Plain text body | Rendered in `<pre>` with `role="region"` `aria-label="Message plain text"` |
| HTML body | Rendered in `<div>` with `role="region"` `aria-label="Message HTML"` |
| Error cards | `role="alert"` on the error card wrapper |
| Skeleton loading | `aria-busy="true"` `aria-label="Loading…"` on the skeleton container div |

**Color contrast:** All text on `bg-primary` uses `text-primary-foreground` (white on dark teal — passes WCAG AA at ≥4.5:1 at `hsl(164 39% 22%)`). `text-muted-foreground` (`hsl(0 0% 45.1%)`) on white background = 4.6:1 (passes AA for normal text at `text-sm`). No custom colors added.

**Focus management:** When navigating to `/emails/[id]`, focus is on the page `<h1>`. When opening the PDF preview pane, focus moves to the pane's close button. When closing, focus returns to the "View" button that opened it.

---

## 13. File Structure Contract

New files to create:

```
apps/web/src/app/emails/
  [id]/
    page.tsx                        ← detail page (server component shell + client EmailDetail)
    _components/
      email-detail.tsx              ← main client component ("use client")
      metadata-card.tsx             ← metadata card
      body-card.tsx                 ← body + tabs
      attachments-card.tsx          ← attachment list rows
      entities-list.tsx             ← detected regions sidebar
      pdf-preview-pane.tsx          ← react-pdf pane + toolbar
      region-overlay-box.tsx        ← single overlay box
      overlay-layer.tsx             ← overlay container for one page
packages/api-client/src/router/emails/
  detail.ts                         ← new emails.detail tRPC procedure (extracted from index.ts)
  index.ts                          ← updated to import + register detail
packages/api-client/src/
  geometry.ts                       ← polygonToRect helper (exported, unit-tested)
  geometry.test.ts                  ← unit tests for polygonToRect
apps/web/src/app/api/attachments/
  [id]/
    route.ts                        ← signed URL handler
```

---

## 14. Out of Scope (Phase 5)

Per 05-CONTEXT.md `<deferred>` section — do NOT implement or stub:

- Region edit operations: accept, redraw, split, merge, nest, reject
- Click-to-autofill flow (POST /v1/components/{id}/autofill)
- Confirm flow (POST /v1/components/{id}/confirm)
- Process / reprocess control buttons
- trgm key_terms extractor
- Auth / per-user tenancy
- FastAPI read API as a data path (tRPC + Drizzle only)
- Disabled / ghost placeholder action buttons (explicitly forbidden per constraints — omit entirely)
- Multiple simultaneous PDF previews
- Dark mode toggle in the UI (tokens are defined but no theme switcher UI)
