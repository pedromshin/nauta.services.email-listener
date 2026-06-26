# Phase 11: Knowledge-node graph view — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## Schema Discrepancy — MUST READ BEFORE IMPLEMENTING

**UI-SPEC Note #3** states "email_components.entity_instance_id" as an edge source.
**This column does not exist on `email_components`.**

Verified against the live schema (`packages/db/src/schema/components.ts`,
`packages/db/migrations/0006_bitter_white_queen.sql`, and all snapshot JSONs):
`email_components` has no `entity_instance_id` column. The correct join path for the
`component ↔ entity_instance` edge (D-04 item 3) is:

```
email_components.id
  → component_entity_candidate_links.component_id
  → component_entity_candidate_links.entity_instance_id
  → entity_instances.id
```

CONTEXT D-04 is correct. UI-SPEC Note #3 is wrong. The executor must use
`component_entity_candidate_links` (not a direct FK on `email_components`) for all
component↔instance edge derivation.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/src/schema/knowledge-node-edges.ts` | model | CRUD | `packages/db/src/schema/knowledge-nodes.ts` | exact |
| `packages/db/src/schema/index.ts` (add 1 export line) | config | — | self | exact |
| `packages/db/migrations/0019_*.sql` | migration | batch | `packages/db/migrations/0006_bitter_white_queen.sql` | exact |
| `packages/api-client/src/router/knowledge/graph.ts` | service | request-response | `packages/api-client/src/router/entities/gallery.ts` | role-match |
| `packages/api-client/src/router/knowledge/list.ts` | service | request-response | `packages/api-client/src/router/entities/gallery.ts` | exact |
| `packages/api-client/src/router/knowledge/detail.ts` | service | request-response | `packages/api-client/src/router/entities/detail.ts` | exact |
| `packages/api-client/src/router/knowledge/index.ts` | config | — | `packages/api-client/src/router/entities/index.ts` | exact |
| `packages/api-client/src/root.ts` (add 1 router line) | config | — | self | exact |
| `apps/web/src/app/knowledge/page.tsx` | route | request-response | `apps/web/src/app/entities/page.tsx` | exact |
| `apps/web/src/app/knowledge/_components/knowledge-graph.tsx` | component | event-driven | `apps/web/src/app/entities/_components/entities-gallery.tsx` | role-match |
| `apps/web/src/components/app-sidebar.tsx` (move nav item) | component | — | self | exact |

---

## Pattern Assignments

### `packages/db/src/schema/knowledge-node-edges.ts` (model, CRUD)

**Analog:** `packages/db/src/schema/knowledge-nodes.ts`

**Imports pattern** (knowledge-nodes.ts lines 13–24):
```typescript
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { KnowledgeNodes } from "./knowledge-nodes";
```
Note: `pgEnum` not needed if `relation_type` stays as plain `text` with a default.
Import `KnowledgeNodes` for the FK reference. No `halfvec` needed (no embedding column
on this table).

**Polymorphic FK pattern** (knowledge-nodes.ts lines 43–55):
```typescript
// Mirror of knowledge_nodes.scope_ref_id / scope_ref_type — same polymorphic idiom
scopeRefId: uuid("scope_ref_id"),
scopeRefType: text("scope_ref_type"),
```
For `knowledge_node_edges`, the polymorphic pair is `target_ref_id` / `target_ref_type`.

**`real` column pattern** (knowledge-nodes.ts line 60):
```typescript
confidence: real("confidence").notNull().default(1.0),
```
Copy this exactly for the `confidence` column on `knowledge_node_edges` (D-05).

**Index pattern** (knowledge-nodes.ts lines 76–83):
```typescript
(t) => ({
  knowledgeNodeImporterScopeIdx: index(
    "idx_knowledge_nodes_importer_scope",
  ).on(t.importerId, t.scope),
  knowledgeNodeImporterActiveIdx: index(
    "idx_knowledge_nodes_importer_active",
  ).on(t.importerId, t.isActive),
}),
```
For `knowledge_node_edges`, create two indexes: one on `source_node_id` and one on
`target_ref_id` (per D-05). Name them `idx_knowledge_node_edges_source` and
`idx_knowledge_node_edges_target`.

**Inferred types pattern** (knowledge-nodes.ts lines 89–91):
```typescript
export type KnowledgeNodeRow = typeof KnowledgeNodes.$inferSelect;
export type InsertKnowledgeNode = typeof KnowledgeNodes.$inferInsert;
```
Mirror as `KnowledgeNodeEdgeRow` / `InsertKnowledgeNodeEdge`.

**Full table shape for this file** (D-05 columns):
```typescript
export const KnowledgeNodeEdges = pgTable(
  "knowledge_node_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceNodeId: uuid("source_node_id")
      .notNull()
      .references(() => KnowledgeNodes.id, { onDelete: "cascade" }),
    targetRefId: uuid("target_ref_id"),          // polymorphic — no FK constraint
    targetRefType: text("target_ref_type"),       // mirrors scope_ref_type idiom
    relationType: text("relation_type").notNull().default("related"),
    confidence: real("confidence").notNull().default(1.0),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    knowledgeNodeEdgesSourceIdx: index(
      "idx_knowledge_node_edges_source_node_id",
    ).on(t.sourceNodeId),
    knowledgeNodeEdgesTargetIdx: index(
      "idx_knowledge_node_edges_target_ref_id",
    ).on(t.targetRefId),
  }),
);
```

---

### `packages/db/src/schema/index.ts` (1-line addition)

**Analog:** self — `packages/db/src/schema/index.ts`

**Barrel export pattern** (index.ts lines 1–22):
```typescript
// Add after the last existing export (component-links line 22):
export * from "./knowledge-node-edges";
```
The barrel follows dependency order. `knowledge-node-edges` depends on `knowledge-nodes`,
which is already exported at line 19 — so append the new export after `component-links`.

---

### `packages/db/migrations/0019_*.sql` (migration, batch)

**Analog:** `packages/db/migrations/0006_bitter_white_queen.sql`

**Migration SQL style** (0006 lines 1–22):
```sql
CREATE TABLE "knowledge_node_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_ref_id" uuid,
	"target_ref_type" text,
	"relation_type" text DEFAULT 'related' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_node_edges" ADD CONSTRAINT
  "knowledge_node_edges_source_node_id_knowledge_nodes_id_fk"
  FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_knowledge_node_edges_source_node_id"
  ON "knowledge_node_edges" USING btree ("source_node_id");
--> statement-breakpoint
CREATE INDEX "idx_knowledge_node_edges_target_ref_id"
  ON "knowledge_node_edges" USING btree ("target_ref_id");
```

**Generation workflow:** run `drizzle-kit generate` from `packages/db/` after writing the
schema file — drizzle-kit names the file with a random adjective-noun suffix
(e.g. `0019_<random>.sql`). Do not hand-write the number; let drizzle-kit assign it.
The last migration is `0018_many_scarecrow.sql` so the next will be `0019_*.sql`.

---

### `packages/api-client/src/router/knowledge/graph.ts` (service, request-response)

**Analog:** `packages/api-client/src/router/entities/gallery.ts`

**Imports pattern** (gallery.ts lines 16–26):
```typescript
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  ComponentEntityCandidateLinks,
  ComponentKnowledgeNodeLinks,
  EmailComponents,
  Emails,
  EntityInstances,
  EntityTypeFields,
  EntityTypes,
  KnowledgeNodeEdges,
  KnowledgeNodes,
} from "@nauta/db/schema";

import { publicProcedure } from "../../trpc";
```

**Input schema pattern** (gallery.ts lines 32–42):
```typescript
// Exported for DB-free testing (mirrors gallery's listInputSchema export)
export const graphInputSchema = z.object({
  importerId: z.string().uuid().optional(),
  includeInstances: z.boolean().default(false),
  includeEmails: z.boolean().default(false),
  nodeTypes: z
    .array(
      z.enum([
        "entity_type",
        "entity_type_field",
        "entity_instance",
        "email_component",
        "email",
        "knowledge_node",
      ]),
    )
    .optional(),
});
export type GraphInput = z.infer<typeof graphInputSchema>;
```

**Pure shaping helper pattern** (gallery.ts lines 83–101):
```typescript
// Export shaping helpers for DB-free testing — mirrors shapeGalleryItem pattern
export interface GraphNode { readonly id: string; readonly type: string; /* ... */ }
export interface GraphEdge { readonly id: string; readonly source: string; readonly target: string; /* ... */ }

export function shapeGraphResponse(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { readonly nodes: ReadonlyArray<GraphNode>; readonly edges: ReadonlyArray<GraphEdge> } {
  return { nodes: [...nodes], edges: [...edges] };
}
```

**Procedure object pattern** (gallery.ts lines 113–120):
```typescript
export const knowledgeGraphProcedures = {
  graph: publicProcedure
    .input(graphInputSchema)
    .query(async ({ ctx, input }) => {
      // 1. entity_type nodes + entity_type → entity_type_field edges (always)
      // 2. entity_instance nodes + edges (when includeInstances or auto-threshold)
      // 3. email_component + email nodes (when includeEmails)
      // 4. knowledge_node nodes (when count > 0)
      // 5. knowledge_node_edges rows (provider seam — D-11)
      // Return { nodes, edges }
    }),
};
```

**Drizzle query pattern** (gallery.ts lines 185–248):
```typescript
// Multi-query approach: separate selects per node type, union results in TS
// Use ctx.db.select({...}).from(EntityTypes).where(and(...whereClauses))
// Never interpolate input into SQL — use parameterized eq/and/sql
```

---

### `packages/api-client/src/router/knowledge/list.ts` (service, request-response)

**Analog:** `packages/api-client/src/router/entities/gallery.ts` (lines 113–285)

**Procedure object pattern** (gallery.ts lines 113–120):
```typescript
export const knowledgeListProcedures = {
  list: publicProcedure
    .input(z.object({ importerId: z.string().uuid().optional(), limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      // Select from KnowledgeNodes where importerId matches + isActive=true
      // Return { items, hasMore, nextOffset } with limit+1 detection
    }),
};
```

**limit+1 detection pattern** (gallery.ts lines 260–284):
```typescript
const hasMore = rawRows.length > input.limit;
const sliced = hasMore ? rawRows.slice(0, input.limit) : rawRows;
return {
  items: sliced.map(shapeItem),
  hasMore,
  nextOffset: input.offset + sliced.length,
};
```

---

### `packages/api-client/src/router/knowledge/detail.ts` (service, request-response)

**Analog:** `packages/api-client/src/router/entities/detail.ts`

**Imports pattern** (detail.ts lines 18–31):
```typescript
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  KnowledgeNodeEdges,
  KnowledgeNodes,
} from "@nauta/db/schema";

import { publicProcedure } from "../../trpc";
```

**byId procedure pattern** (detail.ts lines 137–148):
```typescript
export const knowledgeDetailProcedures = {
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ ... })
        .from(KnowledgeNodes)
        .where(and(eq(KnowledgeNodes.id, input.id), eq(KnowledgeNodes.isActive, true)))
        .limit(1);
      if (!rows[0]) return null;
      // Also query KnowledgeNodeEdges where source_node_id = input.id (empty today)
      return { node: rows[0], edges: [] };
    }),
};
```

**Null-on-missing pattern** (detail.ts line 179):
```typescript
if (!entityRows[0]) return null;  // never throws on missing id
```

---

### `packages/api-client/src/router/knowledge/index.ts` (config)

**Analog:** `packages/api-client/src/router/entities/index.ts` (all 17 lines)

```typescript
/**
 * knowledge/index.ts — compose the knowledge tRPC router.
 */
import { createTRPCRouter } from "../../trpc";
import { knowledgeDetailProcedures } from "./detail";
import { knowledgeGraphProcedures } from "./graph";
import { knowledgeListProcedures } from "./list";

export const knowledgeRouter = createTRPCRouter({
  ...knowledgeGraphProcedures,
  ...knowledgeListProcedures,
  ...knowledgeDetailProcedures,
});
```

---

### `packages/api-client/src/root.ts` (1-line addition)

**Analog:** self — `packages/api-client/src/root.ts` (all 13 lines)

**Registration pattern** (root.ts lines 1–10):
```typescript
import { emailsRouter } from "./router/emails";
import { entitiesRouter } from "./router/entities";
import { entityTypesRouter } from "./router/entity-types";
import { knowledgeRouter } from "./router/knowledge";   // ADD THIS LINE
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  emails: emailsRouter,
  entityTypes: entityTypesRouter,
  entities: entitiesRouter,
  knowledge: knowledgeRouter,                           // ADD THIS LINE
});
```

---

### `apps/web/src/app/knowledge/page.tsx` (route, request-response)

**Analog:** `apps/web/src/app/entities/page.tsx` (all 16 lines)

**Server component wrapper pattern** (entities/page.tsx lines 1–16):
```typescript
import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { KnowledgeGraphSkeleton } from "./_components/knowledge-graph-skeleton";

export const metadata: Metadata = {
  title: "Knowledge — Nauta",
  description: "Visualize the entity and knowledge network extracted from your emails.",
};

// Client island — Canvas/WebGL break SSR (D-08, UI-SPEC Note #1)
const KnowledgeGraph = dynamic(
  () => import("./_components/knowledge-graph").then((m) => m.KnowledgeGraph),
  { ssr: false, loading: () => <KnowledgeGraphSkeleton /> },
);

export default function KnowledgePage(): React.ReactElement {
  return <KnowledgeGraph />;
}
```

Note: `dynamic` with `{ ssr: false }` is the new pattern introduced in this phase.
There is no existing `dynamic` usage in `apps/web/src` to copy from — derive it from
the Next.js App Router docs + the entities page skeleton as the structural analog.

---

### `apps/web/src/app/knowledge/_components/knowledge-graph.tsx` (component, event-driven)

**Analog:** `apps/web/src/app/entities/_components/entities-gallery.tsx`

**"use client" + import pattern** (entities-gallery.tsx lines 1–28):
```typescript
"use client";

import { useCallback, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

import { Badge } from "@nauta/ui/badge";
import { Card } from "@nauta/ui/card";
import { ScrollArea } from "@nauta/ui/scroll-area";
import { Skeleton } from "@nauta/ui/skeleton";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@nauta/ui/resizable";
import { Separator } from "@nauta/ui/separator";
import { Switch } from "@nauta/ui/switch";

import { api } from "~/trpc/react";
```

**tRPC query pattern** (entities-gallery.tsx uses `api.entities.list.useQuery`):
```typescript
const { data, isLoading, error } = api.knowledge.graph.useQuery({
  importerId: undefined,         // D-12: derived server-side, never from URL
  includeInstances: showInstances,
  includeEmails: showEmails,
});
```

**Local state pattern** (entities-gallery.tsx lines 34–40):
```typescript
// All state is local — no URL params for the graph view
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
const [showInstances, setShowInstances] = useState<boolean>(false);
const [showEmails, setShowEmails] = useState<boolean>(false);
const [visibleTypes, setVisibleTypes] = useState<Set<string>>(
  new Set(["entity_type", "entity_type_field"]),
);
const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("nauta.knowledge.taxonomy-banner-dismissed") === "true";
});
```

**Skeleton pattern** (entities-gallery.tsx + entity-knowledge.tsx):
```typescript
export function KnowledgeGraphSkeleton(): React.ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading knowledge graph"
      className="flex flex-col items-center justify-center gap-4 p-8"
    >
      {/* 3 entity_type ghost rectangles */}
      <div className="flex gap-8">
        <Skeleton className="h-12 w-40 rounded-lg" />
        <Skeleton className="h-12 w-40 rounded-lg" />
        <Skeleton className="h-12 w-40 rounded-lg" />
      </div>
      {/* 5 entity_type_field ghost rectangles */}
      <div className="flex gap-4">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
    </div>
  );
}
```

**Knowledge node card reuse pattern** (entity-knowledge.tsx lines 13–20):
```typescript
// Import the interface and card from the entity-detail component — do not re-define
import type { KnowledgeNode } from "~/app/entities/[id]/_components/entity-knowledge";
// Use in the detail pane knowledge_node branch:
//   node.title, node.content, node.source, node.confidence, node.createdAt
//   Badge: "Knowledge Rule" / Math.round(node.confidence * 100) + "% confidence"
//   format(node.createdAt, "PP") from date-fns
```

---

### `apps/web/src/components/app-sidebar.tsx` (modified, nav promotion)

**Analog:** self — lines 36–44

**Current state** (app-sidebar.tsx lines 36–45):
```typescript
const LIVE_NAV_ITEMS: ReadonlyArray<LiveNavItem> = [
  { href: "/", label: "Inbox", icon: Inbox },
  { href: "/entity-types", label: "Entity Types", icon: Shapes },
  { href: "/entities", label: "Entities", icon: Boxes },
];

const SOON_NAV_ITEMS: ReadonlyArray<SoonNavItem> = [
  { label: "Knowledge", icon: Share2, soon: true }, // → Phase 11
];
```

**Target state** (move Knowledge to LIVE, remove from SOON):
```typescript
// D-20 nav order: Inbox · Entity Types (live) · Entities (live) · Knowledge (live).
const LIVE_NAV_ITEMS: ReadonlyArray<LiveNavItem> = [
  { href: "/", label: "Inbox", icon: Inbox },
  { href: "/entity-types", label: "Entity Types", icon: Shapes },
  { href: "/entities", label: "Entities", icon: Boxes },
  { href: "/knowledge", label: "Knowledge", icon: Share2 },  // ← promoted Phase 11
];

const SOON_NAV_ITEMS: ReadonlyArray<SoonNavItem> = [];  // Knowledge removed
```

The `isActiveRoute` function at line 48 handles active-state automatically — no changes
needed to it. `Share2` is already imported at line 4.

---

## Shared Patterns

### tRPC publicProcedure + Drizzle context
**Source:** `packages/api-client/src/trpc.ts` (lines 23–63)
**Apply to:** All three knowledge router files (`graph.ts`, `list.ts`, `detail.ts`)
```typescript
// Context carries only the Drizzle db handle — no auth
export const createTRPCContext = (opts: { headers: Headers }) => ({
  headers: opts.headers,
  db,                    // @nauta/db/client
});
// Use publicProcedure for all knowledge procedures (read-only, D-09)
```

### Immutable return objects
**Source:** `packages/api-client/src/router/entities/gallery.ts` (lines 89–101)
**Apply to:** All service files and component state updates
```typescript
// Always spread — never mutate
return { ...entry, confidence: row.confidence ?? 1.0 };
// Spread for array results too
return { nodes: [...nodes], edges: [...edges] };
```

### Named exports exclusively
**Source:** all existing files in `packages/api-client/src/router/`
**Apply to:** All new files — no default exports on procedures or helpers
```typescript
export const knowledgeGraphProcedures = { ... };   // named
export type GraphInput = ...;                       // named
export function shapeGraphResponse(...) { ... }     // named
```

### Input validation with Zod + allow-lists
**Source:** `packages/api-client/src/router/entities/gallery.ts` (lines 32–42)
**Apply to:** All knowledge procedure input schemas
```typescript
// Enums MUST use z.enum([...]) — not z.string() — for node type filters (T-10-34 pattern)
nodeTypes: z.array(z.enum(["entity_type", "entity_type_field", ...])).optional()
// Limit capped: z.number().int().min(1).max(100)
// Search capped: z.string().max(200)
```

### Parameterized SQL only
**Source:** `packages/api-client/src/router/entities/gallery.ts` (lines 157–165)
**Apply to:** All Drizzle queries in knowledge router
```typescript
// ALWAYS use Drizzle builders or sql template tag with bound params
// NEVER string-interpolate user input into SQL
whereClauses.push(eq(KnowledgeNodes.importerId, input.importerId));
// sql template with bound value (not interpolation):
sql`${KnowledgeNodes.content} ILIKE ${term}`
```

### Tenant isolation from data row
**Source:** CONTEXT D-12 / Phase 9 D-18 / Phase 10 D-21
**Apply to:** `knowledge/graph.ts`, `knowledge/list.ts`
```typescript
// importerId is an OPTIONAL input filter — never derived from a trusted caller claim
// The query may also derive importerId from the data row itself
// NEVER trust URL params as the sole tenant identifier
```

### Error: null-on-missing, never throw
**Source:** `packages/api-client/src/router/entities/detail.ts` (line 179)
**Apply to:** `knowledge/detail.ts`
```typescript
if (!rows[0]) return null;
// Callers check for null — no 404 exception thrown from tRPC layer
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| React Flow custom node components (inside `knowledge-graph.tsx`) | component | event-driven | No React Flow nodes exist anywhere in the codebase. Derive from `@xyflow/react` docs + UI-SPEC Node Visual Language section. |
| Dagre layout utility (inside `knowledge-graph.tsx`) | utility | transform | No dagre usage exists in the codebase. Derive from `@dagrejs/dagre` API + UI-SPEC Layout Algorithm section. |

---

## Metadata

**Analog search scope:** `packages/db/src/schema/`, `packages/api-client/src/router/`,
`apps/web/src/app/`, `apps/web/src/components/`
**Files scanned:** 14 source files read + migration directory listed
**Pattern extraction date:** 2026-06-15
