# Phase 10: Extracted Entity Identity Gallery & Detail — Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 21 new/modified files
**Analogs found:** 21 / 21

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/db/src/schema/entity-instances.ts` | model | CRUD | `packages/db/src/schema/entity-instances.ts` (self, modify) | self |
| `packages/db/migrations/0015_entity_identity.sql` | migration | batch | `packages/db/migrations/0013_fixed_jamie_braddock.sql` | exact |
| `packages/api-client/src/router/entities/index.ts` | router | request-response | `packages/api-client/src/router/emails/index.ts` | exact |
| `packages/api-client/src/router/entities/gallery.ts` | route | CRUD | `packages/api-client/src/router/emails/index.ts` (list procedure) | role-match |
| `packages/api-client/src/router/entities/detail.ts` | route | CRUD | `packages/api-client/src/router/emails/detail.ts` | exact |
| `packages/api-client/src/router/entities/mutations.ts` | route | request-response | `packages/api-client/src/router/emails/mutations.ts` | exact |
| `packages/api-client/src/router/index.ts` | router | request-response | `packages/api-client/src/router/index.ts` (modify) | self |
| `apps/web/src/app/entities/page.tsx` | component | request-response | `apps/web/src/app/entity-types/page.tsx` | exact |
| `apps/web/src/app/entities/[id]/page.tsx` | component | request-response | `apps/web/src/app/emails/[id]/page.tsx` | role-match |
| `apps/web/src/app/entities/[id]/_components/entity-detail.tsx` | component | request-response | `apps/web/src/app/emails/[id]/_components/email-detail.tsx` | exact |
| `apps/web/src/app/entities/[id]/_components/use-entity-curation.ts` | hook | event-driven | `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` | exact |
| `apps/email-listener/app/domain/ports/entity_instance_repository.py` | port | CRUD | `apps/email-listener/app/domain/ports/component_repository.py` | exact |
| `apps/email-listener/app/infrastructure/supabase/entity_instance_repository.py` | service | CRUD | `apps/email-listener/app/infrastructure/supabase/component_repository.py` | exact |
| `apps/email-listener/app/infrastructure/supabase/entity_resolution_repository.py` | service | event-driven | `apps/email-listener/app/infrastructure/supabase/retrieval_repository.py` | exact |
| `apps/email-listener/app/domain/entities/entity_instance.py` | model | CRUD | `apps/email-listener/app/domain/entities/` (existing entity models) | role-match |
| `apps/email-listener/app/application/use_cases/confirm_entity.py` | service | event-driven | `apps/email-listener/app/application/use_cases/confirm_region.py` | exact |
| `apps/email-listener/app/application/use_cases/reject_entity.py` | service | event-driven | `apps/email-listener/app/application/use_cases/confirm_region.py` | role-match |
| `apps/email-listener/app/application/use_cases/unmerge_entity.py` | service | event-driven | `apps/email-listener/app/application/use_cases/confirm_region.py` | role-match |
| `apps/email-listener/app/application/use_cases/resolve_entity_candidates.py` | service | event-driven | `apps/email-listener/app/infrastructure/supabase/retrieval_repository.py` | role-match |
| `apps/email-listener/app/presentation/api/v1/entity_instances.py` | controller | request-response | `apps/email-listener/app/presentation/api/v1/components.py` | exact |
| `apps/email-listener/app/container.py` | config | CRUD | `apps/email-listener/app/container.py` (self, modify) | self |

---

## Pattern Assignments

### `packages/db/migrations/0015_entity_identity.sql` (migration, batch)

**Analog:** `packages/db/migrations/0013_fixed_jamie_braddock.sql`

**Core DDL pattern** (lines 1-23 of 0013):
```sql
-- Phase N (D-xx): description of change.
-- IF NOT EXISTS guards so the migration is idempotent and safe to re-run.

ALTER TABLE "entity_instances" ALTER COLUMN "nauta_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entity_instances" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'email_extracted';--> statement-breakpoint
DROP INDEX IF EXISTS "entity_instance_unique_per_importer";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_instance_unique_per_importer"
  ON "entity_instances" ("importer_id", "entity_type_id", "nauta_id")
  WHERE "nauta_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "entity_instance_unique_extracted"
  ON "entity_instances" ("importer_id", "entity_type_id", "source")
  WHERE "source" = 'email_extracted';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entity_instances_gallery"
  ON "entity_instances" ("importer_id", "entity_type_id", "source");
```

**Key constraint:** Must use `IF NOT EXISTS` guards (idempotent across staging/prod). Never re-add enum values or columns that may already exist on live DB.

---

### `packages/db/src/schema/entity-instances.ts` (model, CRUD — modify)

**Analog:** self (current state), plus `packages/db/migrations/0013_fixed_jamie_braddock.sql` for constraint names.

**Current state that changes** (lines 1-40 of current schema):
```typescript
// BEFORE (Phase 4):
nautaId: text("nauta_id").notNull(),
// unique constraint includes nautaId

// AFTER (Phase 10) — make nullable, add source, reshape unique:
nautaId: text("nauta_id"),   // DROP NOT NULL
source: text("source").notNull().default("email_extracted"),
// Replace the old uniqueConstraint with two partial-unique indexes in migration
// Add gallery index: .on(t.importerId, t.entityTypeId, t.source)
```

---

### `packages/api-client/src/router/entities/gallery.ts` (route, CRUD)

**Analog:** `packages/api-client/src/router/emails/index.ts` (list procedure, lines 1-60)

**Imports pattern:**
```typescript
import { z } from "zod";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@nauta/db";
import { EntityInstances, EntityTypes } from "@nauta/db/schema";

import { publicProcedure } from "../../trpc";
```

**Limit+1 pagination pattern** (from `emails/index.ts` lines 24-55):
```typescript
export const entityGalleryProcedures = {
  gallery: publicProcedure
    .input(
      z.object({
        entityTypeId: z.string().uuid().optional(),
        importerId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const rows = await db
        .select({ /* ... */ })
        .from(EntityInstances)
        .where(
          and(
            eq(EntityInstances.source, "email_extracted"),
            input.entityTypeId
              ? eq(EntityInstances.entityTypeId, input.entityTypeId)
              : undefined,
            input.importerId
              ? eq(EntityInstances.importerId, input.importerId)
              : undefined,
          ),
        )
        .orderBy(desc(EntityInstances.createdAt))
        .limit(input.limit + 1)
        .offset(input.offset);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return { items, hasMore, nextOffset: input.offset + items.length };
    }),
};
```

**Key rule:** Always filter `source = 'email_extracted'` — never expose nauta-id records to this surface.

---

### `packages/api-client/src/router/entities/detail.ts` (route, CRUD)

**Analog:** `packages/api-client/src/router/emails/detail.ts`

**Imports pattern** (lines 1-10 of detail.ts):
```typescript
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@nauta/db";
import { EntityInstances, EmailComponents, ExtractionRecords } from "@nauta/db/schema";

import { publicProcedure } from "../../trpc";
```

**byId procedure pattern** (from `emails/detail.ts` lines 15-40):
```typescript
export const entityDetailProcedures = {
  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({ /* entity fields + joined occurrences */ })
        .from(EntityInstances)
        .leftJoin(EmailComponents, eq(EmailComponents.entityInstanceId, EntityInstances.id))
        .leftJoin(
          ExtractionRecords,
          and(
            eq(ExtractionRecords.id, EmailComponents.extractionRecordId),
            ne(ExtractionRecords.status, "superseded"),
          ),
        )
        .where(eq(EntityInstances.id, input.id));

      if (rows.length === 0) return null;
      return rows[0] ?? null;
    }),
};
```

**Dedupe-preferring-confirmed Map idiom** (from `emails/detail.ts` lines 50-65 — use for occurrence dedup when a component appears in multiple extraction records):
```typescript
const byId = new Map<string, (typeof componentRows)[number]>();
for (const row of componentRows) {
  const existing = byId.get(row.id);
  if (
    existing === undefined ||
    (row.extractionRecordStatus === "confirmed" &&
      existing.extractionRecordStatus !== "confirmed")
  ) {
    byId.set(row.id, row);
  }
}
return Array.from(byId.values());
```

---

### `packages/api-client/src/router/entities/mutations.ts` (route, request-response)

**Analog:** `packages/api-client/src/router/emails/mutations.ts`

**Full FastAPI proxy pattern** (from `mutations.ts` lines 1-50):
```typescript
import { z } from "zod";
import { getListenerConfig, parseErrorDetail } from "../_listener-config";
import { publicProcedure } from "../../trpc";

export const entityMutationProcedures = {
  confirmEntity: publicProcedure
    .input(z.object({ entityInstanceId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-instances/${input.entityInstanceId}/confirm`,
        {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "confirm failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  rejectEntity: publicProcedure
    .input(z.object({ entityInstanceId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-instances/${input.entityInstanceId}/reject`,
        {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "reject failed"));
      }
      return res.json() as Promise<unknown>;
    }),

  unmergeEntity: publicProcedure
    .input(z.object({ entityInstanceId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { url, apiKey } = getListenerConfig();
      const res = await fetch(
        `${url}/v1/entity-instances/${input.entityInstanceId}/unmerge`,
        {
          method: "POST",
          headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(await parseErrorDetail(res, "unmerge failed"));
      }
      return res.json() as Promise<unknown>;
    }),
};
```

**Security rule:** `getListenerConfig()` is called at request time (not module init). The key is never in client-importable code and never prefixed `NEXT_PUBLIC_`.

---

### `packages/api-client/src/router/entities/index.ts` (router, request-response)

**Analog:** `packages/api-client/src/router/emails/index.ts`

**Router composition pattern** (lines 90-100 of emails/index.ts):
```typescript
import { createTRPCRouter } from "../../trpc";
import { entityGalleryProcedures } from "./gallery";
import { entityDetailProcedures } from "./detail";
import { entityMutationProcedures } from "./mutations";

export const entitiesRouter = createTRPCRouter({
  ...entityGalleryProcedures,
  ...entityDetailProcedures,
  ...entityMutationProcedures,
});
```

---

### `packages/api-client/src/router/index.ts` (router — modify)

**Pattern:** Add `entities: entitiesRouter` alongside the existing `emails:` and `entityTypes:` entries. Copy exact import style from the existing file.

---

### `apps/web/src/app/entities/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/entity-types/page.tsx`

**Full shell pattern** (lines 1-120 of entity-types/page.tsx):
```typescript
"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@nauta/ui/skeleton";
import { api } from "~/trpc/react";

export default function EntitiesPage(): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = api.entities.gallery.useQuery({
    limit: 50,
  });

  // Default-select first on load
  useEffect(() => {
    if (selectedId === null && data?.items?.[0]) {
      setSelectedId(data.items[0].id);
    }
  }, [selectedId, data]);

  return (
    <div className="flex h-svh overflow-hidden">
      {/* Aside list */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border/50">
        <div className="flex h-11 items-center border-b border-border/50 bg-background/70 px-3 backdrop-blur-md">
          <span className="text-sm font-semibold">Entities</span>
        </div>
        <div className="flex-1 overflow-auto bg-background/70 backdrop-blur-md">
          {isLoading && (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          )}
          {isError && (
            <div className="p-4 text-sm text-destructive">
              Failed to load entities.
            </div>
          )}
          {data?.items.map((entity) => (
            <button
              key={entity.id}
              type="button"
              onClick={() => setSelectedId(entity.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedId === entity.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              {entity.displayName}
            </button>
          ))}
        </div>
      </aside>
      {/* Detail pane */}
      <main className="flex flex-1 flex-col overflow-auto">
        {selectedId ? <EntityDetail entityId={selectedId} /> : null}
      </main>
    </div>
  );
}
```

**Glass header tokens:** `h-11 items-center border-b border-border/50 bg-background/70 px-3 backdrop-blur-md`
**Active button:** `bg-primary/10 text-primary`
**Inactive button:** `hover:bg-muted`

---

### `apps/web/src/app/entities/[id]/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/emails/[id]/page.tsx` (pass `params.id` down to client component)

**Pattern:** Server component that receives `{ params: { id: string } }` and renders `<EntityDetailPage entityId={id} />`. No auth logic at this level — mirrors how email detail page delegates to `email-detail.tsx`.

---

### `apps/web/src/app/entities/[id]/_components/entity-detail.tsx` (component, request-response)

**Analog:** `apps/web/src/app/emails/[id]/_components/email-detail.tsx`

**Imports + query pattern** (lines 1-20 of email-detail.tsx):
```typescript
"use client";

import { useRef } from "react";
import Link from "next/link";
import { Badge } from "@nauta/ui/badge";
import { Card } from "@nauta/ui/card";
import { Skeleton } from "@nauta/ui/skeleton";
import { api } from "~/trpc/react";

export function EntityDetail({ entityId }: { readonly entityId: string }): React.ReactElement {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const utils = api.useUtils();

  const { data, isLoading, isError } = api.entities.byId.useQuery({ id: entityId });
```

**Three-state render pattern** (lines 30-70 of email-detail.tsx):
```typescript
  // Loading state
  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  // Error state
  if (isError) {
    return (
      <Card className="border-destructive p-6 text-sm text-destructive">
        Failed to load entity. Please try again.
      </Card>
    );
  }

  // Not found
  if (data === null) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Entity not found.
      </Card>
    );
  }
```

**Header pattern** (lines 75-90 of email-detail.tsx):
```typescript
  return (
    <main className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3 shrink-0">
        <Link href="/entities" className="text-sm text-muted-foreground hover:text-foreground">
          ← Entities
        </Link>
        <h1 ref={h1Ref} tabIndex={-1} className="text-lg font-semibold">
          {data.displayName}
        </h1>
        <Badge variant="outline">{data.entityTypeName}</Badge>
      </header>
      <div className="flex-1 min-h-0 overflow-auto">
        {/* occurrences, aggregated fields, knowledge nodes, pending dupes */}
      </div>
    </main>
  );
```

**Invalidation after mutation:**
```typescript
const handleConfirm = async (): Promise<void> => {
  await confirmMutation.mutateAsync({ entityInstanceId: entityId });
  await utils.entities.byId.invalidate({ id: entityId });
  await utils.entities.gallery.invalidate();
};
```

---

### `apps/web/src/app/entities/[id]/_components/use-entity-curation.ts` (hook, event-driven)

**Analog:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts`

**Optimistic snapshot/revert pattern** (lines 79-107 of use-region-edit.ts):
```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export interface EntityCurationState {
  readonly mutatingIds: readonly string[];
  confirm: (id: string) => void;
  reject: (id: string) => void;
  unmerge: (id: string) => void;
}

export function useEntityCuration({ entityId }: { readonly entityId: string }): EntityCurationState {
  const utils = api.useUtils();

  const confirmMutation = api.entities.confirmEntity.useMutation({
    onMutate: ({ entityInstanceId }: { entityInstanceId: string }) => {
      // Snapshot for revert
      const prevData = utils.entities.byId.getData({ id: entityId });
      // Optimistic: flip isActive or status field
      utils.entities.byId.setData({ id: entityId }, (prev) => {
        if (!prev) return prev;
        return { ...prev, isActive: true };
      });
      return { prevData };
    },
    onSuccess: async () => {
      await utils.entities.byId.invalidate({ id: entityId });
      await utils.entities.gallery.invalidate();
      toast.success("Entity confirmed");
    },
    onError: (_err, _vars, context) => {
      if (context?.prevData !== undefined) {
        utils.entities.byId.setData({ id: entityId }, context.prevData);
      }
      toast.error("Could not confirm entity. Try again.");
    },
  });

  // mutatingIds drives aria-busy + pulse (mirrors use-region-edit.ts lines 218-240)
  const mutatingIds: readonly string[] = [
    ...(confirmMutation.isPending && confirmMutation.variables
      ? [confirmMutation.variables.entityInstanceId]
      : []),
    // ... rejectMutation.variables, unmerge...
  ];

  function confirm(id: string): void {
    confirmMutation.mutate({ entityInstanceId: id });
  }

  // ... reject, unmerge handlers ...

  return { mutatingIds, confirm, reject, unmerge };
}
```

**Key rule:** `prevData` snapshot in `onMutate`, revert via `.setData(prevData)` in `onError`. Invalidate both `byId` and `gallery` on success (two-cache invalidation).

---

### `apps/email-listener/app/domain/ports/entity_instance_repository.py` (port, CRUD)

**Analog:** `apps/email-listener/app/domain/ports/component_repository.py`

**Protocol port pattern** (lines 1-30 of component_repository.py):
```python
"""EntityInstanceRepository port — domain abstraction over entity_instance persistence."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from app.domain.entities.entity_instance import EntityInstance


class EntityInstanceRepository(Protocol):
    """Port for entity instance reads and writes."""

    async def find_by_id(self, entity_instance_id: str) -> EntityInstance | None:
        """Return the entity instance with the given id, or None."""
        ...

    async def save(self, entity_instance: EntityInstance) -> EntityInstance:
        """Persist (insert or upsert) an entity instance; return the saved row."""
        ...

    async def update_status(
        self,
        entity_instance_id: str,
        *,
        is_active: bool,
    ) -> EntityInstance:
        """Toggle active/inactive; raises ValueError when id not found."""
        ...

    async def list_by_importer(
        self,
        importer_id: str,
        *,
        entity_type_id: str | None = None,
        source: str = "email_extracted",
        limit: int = 50,
        offset: int = 0,
    ) -> list[EntityInstance]:
        """List entity instances, always filtering by source discriminator."""
        ...
```

**Key rule:** `TYPE_CHECKING` guard prevents circular imports. All async def, return type annotations mandatory.

---

### `apps/email-listener/app/infrastructure/supabase/entity_instance_repository.py` (service, CRUD)

**Analog:** `apps/email-listener/app/infrastructure/supabase/component_repository.py`

**Class skeleton + row mappers pattern** (lines 1-60 of component_repository.py):
```python
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import structlog

from supabase import Client

from app.domain.entities.entity_instance import EntityInstance
from app.domain.ports.entity_instance_repository import EntityInstanceRepository
from app.infrastructure.supabase.sanitize import parse_embedding, strip_nul

logger = structlog.get_logger(__name__)


class SupabaseEntityInstanceRepository:
    """Supabase implementation of EntityInstanceRepository."""

    def __init__(self, client: Client) -> None:
        self._client = client

    # ── Private mappers ──────────────────────────────────────────────────────

    @staticmethod
    def _from_row(row: dict[str, Any]) -> EntityInstance:
        return EntityInstance(
            id=row["id"],
            importer_id=row["importer_id"],
            entity_type_id=row["entity_type_id"],
            nauta_id=row.get("nauta_id"),          # nullable in Phase 10
            source=row["source"],
            display_name=strip_nul(row["display_name"]),
            identifiers=row.get("identifiers") or {},
            aliases=row.get("aliases") or [],
            summary_text=row.get("summary_text"),
            embedding=parse_embedding(row.get("embedding")),
            is_active=row.get("is_active", True),
        )

    async def find_by_id(self, entity_instance_id: str) -> EntityInstance | None:
        result = (
            self._client.table("entity_instances")
            .select("*")
            .eq("id", entity_instance_id)
            .execute()
        )
        if not result.data:
            return None
        return self._from_row(result.data[0])

    async def update_status(self, entity_instance_id: str, *, is_active: bool) -> EntityInstance:
        result = (
            self._client.table("entity_instances")
            .update({"is_active": is_active})
            .eq("id", entity_instance_id)
            .execute()
        )
        if not result.data:
            raise ValueError(f"EntityInstance not found: {entity_instance_id}")
        return self._from_row(result.data[0])
```

**Not-found pattern:** `.execute()` → `if not result.data: return None` for reads; `raise ValueError(f"... not found: {id}")` for writes.

---

### `apps/email-listener/app/infrastructure/supabase/entity_resolution_repository.py` (service, event-driven)

**Analog:** `apps/email-listener/app/infrastructure/supabase/retrieval_repository.py`

**RRF + BlendedRAG pattern** (full retrieval_repository.py — key sections):

```python
"""EntityResolutionRepository — BlendedRAG retrieval over entity_instances.

Mirrors retrieval_repository.py but targets entity_instances instead of
email_components. Both arms filter importer_id (cross-tenant isolation, T-04-28).
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import structlog

from supabase import Client

logger = structlog.get_logger(__name__)

_K_DEFAULT = 60


@dataclass(frozen=True)
class EntityCandidate:
    """A candidate entity instance returned by resolution."""
    entity_instance_id: str
    display_name: str
    rrf_score: float


def _rrf_score(rank: int, k: int = _K_DEFAULT) -> float:
    """Reciprocal Rank Fusion score: 1 / (k + rank)."""
    return 1.0 / (k + rank)


def _merge_rrf(ranked_lists: list[list[str]]) -> list[str]:
    """Merge multiple ranked id lists via RRF; return ids sorted by fused score desc."""
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, entity_id in enumerate(ranked, start=1):
            scores[entity_id] = scores.get(entity_id, 0.0) + _rrf_score(rank)
    return sorted(scores, key=lambda eid: scores[eid], reverse=True)


class SupabaseEntityResolutionRepository:
    def __init__(self, client: Client) -> None:
        self._client = client

    async def find_candidates(
        self,
        *,
        display_name: str,
        entity_type_id: str,
        importer_id: str,
        embedding: list[float] | None,
        key_terms: list[str],
        top_n: int = 5,
    ) -> list[EntityCandidate]:
        """BlendedRAG: run vector + trgm arms, fuse via RRF(k=60)."""
        vector_ids = await self._vector_query(
            embedding=embedding,
            entity_type_id=entity_type_id,
            importer_id=importer_id,
            top_n=top_n * 3,
        ) if embedding else []

        trgm_ids = await self._trgm_query(
            key_terms=key_terms,
            entity_type_id=entity_type_id,
            importer_id=importer_id,
            top_n=top_n * 3,
        )

        merged = _merge_rrf([vector_ids, trgm_ids])[:top_n]
        return await self._hydrate(merged)

    async def _vector_query(
        self,
        *,
        embedding: list[float],
        entity_type_id: str,
        importer_id: str,
        top_n: int,
    ) -> list[str]:
        """HNSW arm — match_entities_by_embedding RPC."""
        try:
            result = self._client.rpc(
                "match_entities_by_embedding",
                {
                    "query_embedding": embedding,
                    "match_entity_type_id": entity_type_id,
                    "match_importer_id": importer_id,   # cross-tenant isolation
                    "match_count": top_n,
                },
            ).execute()
            return [row["id"] for row in (result.data or [])]
        except Exception:
            logger.exception("entity vector query failed — falling back to lexical arm")
            return []

    async def _trgm_query(
        self,
        *,
        key_terms: list[str],
        entity_type_id: str,
        importer_id: str,
        top_n: int,
    ) -> list[str]:
        """pg_trgm arm — match_entities_by_trgm RPC. Bedrock-free."""
        try:
            result = self._client.rpc(
                "match_entities_by_trgm",
                {
                    "query_terms": key_terms,
                    "match_entity_type_id": entity_type_id,
                    "match_importer_id": importer_id,   # cross-tenant isolation
                    "match_count": top_n,
                },
            ).execute()
            return [row["id"] for row in (result.data or [])]
        except Exception:
            logger.exception("entity trgm query failed")
            return []
```

**Graceful degradation:** If Bedrock embeddings unavailable, `embedding=None` → skip `_vector_query` → lexical-only. Both sub-queries filter `importer_id` — never cross-tenant.

---

### `apps/email-listener/app/domain/entities/entity_instance.py` (model, CRUD)

**Analog:** existing frozen dataclass entity models in `app/domain/entities/`

**Frozen dataclass pattern** (from component_repository.py domain imports):
```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntityInstance:
    """Immutable domain entity — email-extracted or promoted identity."""
    id: str
    importer_id: str
    entity_type_id: str
    nauta_id: str | None          # nullable — email_extracted rows have None
    source: str                   # "email_extracted" discriminator
    display_name: str
    identifiers: dict[str, object]
    aliases: list[str]
    summary_text: str | None
    embedding: list[float] | None
    is_active: bool
```

**Key rule:** `frozen=True` for all domain entities (immutability CRITICAL per CLAUDE.md). `nauta_id` is `str | None` post-Phase-10 migration.

---

### `apps/email-listener/app/application/use_cases/confirm_entity.py` (service, event-driven)

**Analog:** `apps/email-listener/app/application/use_cases/confirm_region.py`

**Use case pattern** (lines 1-60 of confirm_region.py):
```python
"""ConfirmEntityUseCase — promote a pending entity instance to confirmed."""

from __future__ import annotations

import structlog

from app.domain.entities.entity_instance import EntityInstance
from app.domain.ports.entity_instance_repository import EntityInstanceRepository

logger = structlog.get_logger(__name__)


class ConfirmEntityUseCase:
    def __init__(
        self,
        *,
        entity_instances: EntityInstanceRepository,
    ) -> None:
        self._entity_instances = entity_instances

    async def execute(self, *, entity_instance_id: str) -> EntityInstance:
        log = logger.bind(entity_instance_id=entity_instance_id)

        instance = await self._entity_instances.find_by_id(entity_instance_id)
        if instance is None:
            raise ValueError(f"EntityInstance not found: {entity_instance_id}")

        # Derive importer_id from the data row — never from caller (D-18/D-21)
        importer_id = instance.importer_id

        log.info("confirming entity instance", importer_id=importer_id)

        # Immutable update: return new object, never mutate
        confirmed = EntityInstance(
            **{**instance.__dict__, "is_active": True},
        )

        result = await self._entity_instances.save(confirmed)
        log.info("entity instance confirmed")
        return result
```

**Key pattern:** `importer_id = instance.importer_id` — tenant isolation from the data row, never from the caller parameter. Constructor uses keyword-only args (`*`). `structlog.get_logger(__name__)` + `logger.bind(...)`.

---

### `apps/email-listener/app/application/use_cases/reject_entity.py` (service, event-driven)

**Analog:** `apps/email-listener/app/application/use_cases/confirm_region.py`

Same structure as `confirm_entity.py` above but sets `is_active=False`. Raises `ValueError` (mapped to 404) if instance not found.

---

### `apps/email-listener/app/application/use_cases/unmerge_entity.py` (service, event-driven)

**Analog:** `apps/email-listener/app/application/use_cases/confirm_region.py`

Same constructor shape. `execute()` clears the `nauta_id` FK on the instance (sets back to `None`) so it becomes an isolated email-extracted record again. Supersede-never-mutate: create a new `EntityInstance` with `nauta_id=None` and persist; never overwrite the original.

---

### `apps/email-listener/app/application/use_cases/resolve_entity_candidates.py` (service, event-driven)

**Analog:** retrieval use case + `retrieval_repository.py` RRF logic

**Use case pattern:**
```python
"""ResolveEntityCandidatesUseCase — BlendedRAG suggestion for entity dedup."""

from __future__ import annotations

import structlog

from app.domain.ports.entity_instance_repository import EntityInstanceRepository
from app.infrastructure.supabase.entity_resolution_repository import (
    EntityCandidate,
    SupabaseEntityResolutionRepository,
)

logger = structlog.get_logger(__name__)


class ResolveEntityCandidatesUseCase:
    def __init__(
        self,
        *,
        entity_instances: EntityInstanceRepository,
        resolution: SupabaseEntityResolutionRepository,
    ) -> None:
        self._entity_instances = entity_instances
        self._resolution = resolution

    async def execute(
        self,
        *,
        entity_instance_id: str,
        top_n: int = 5,
    ) -> list[EntityCandidate]:
        instance = await self._entity_instances.find_by_id(entity_instance_id)
        if instance is None:
            raise ValueError(f"EntityInstance not found: {entity_instance_id}")

        # Suggest-only: never auto-decide (D-05/D-07)
        return await self._resolution.find_candidates(
            display_name=instance.display_name,
            entity_type_id=instance.entity_type_id,
            importer_id=instance.importer_id,   # cross-tenant isolation
            embedding=instance.embedding,         # None → lexical-only fallback
            key_terms=_extract_key_terms(instance.display_name),
            top_n=top_n,
        )
```

---

### `apps/email-listener/app/presentation/api/v1/entity_instances.py` (controller, request-response)

**Analog:** `apps/email-listener/app/presentation/api/v1/components.py`

**Router setup + endpoint pattern** (lines 1-70 of components.py):
```python
"""Entity instances API — confirm / reject / unmerge + resolution suggestions."""

from __future__ import annotations

from uuid import UUID

from dishka.integrations.fastapi import FromDishka, inject
from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases.confirm_entity import ConfirmEntityUseCase
from app.application.use_cases.reject_entity import RejectEntityUseCase
from app.application.use_cases.unmerge_entity import UnmergeEntityUseCase
from app.application.use_cases.resolve_entity_candidates import ResolveEntityCandidatesUseCase
from app.presentation.api.auth import require_api_key
from app.presentation.api.schemas import ApiResponse

router = APIRouter(
    prefix="/v1/entity-instances",
    tags=["entity-instances"],
    dependencies=[Depends(require_api_key)],
)

_NOT_FOUND_DETAIL = "Entity instance not found"


@router.post("/{entity_instance_id}/confirm")
@inject
async def confirm_entity(
    entity_instance_id: UUID,
    use_case: FromDishka[ConfirmEntityUseCase],
) -> ApiResponse[dict]:
    try:
        result = await use_case.execute(entity_instance_id=str(entity_instance_id))
        return ApiResponse.ok({"id": result.id, "is_active": result.is_active})
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc


@router.post("/{entity_instance_id}/reject")
@inject
async def reject_entity(
    entity_instance_id: UUID,
    use_case: FromDishka[RejectEntityUseCase],
) -> ApiResponse[dict]:
    try:
        result = await use_case.execute(entity_instance_id=str(entity_instance_id))
        return ApiResponse.ok({"id": result.id, "is_active": result.is_active})
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc


@router.post("/{entity_instance_id}/unmerge")
@inject
async def unmerge_entity(
    entity_instance_id: UUID,
    use_case: FromDishka[UnmergeEntityUseCase],
) -> ApiResponse[dict]:
    try:
        result = await use_case.execute(entity_instance_id=str(entity_instance_id))
        return ApiResponse.ok({"id": result.id, "nauta_id": result.nauta_id})
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc


@router.get("/{entity_instance_id}/candidates")
@inject
async def get_resolution_candidates(
    entity_instance_id: UUID,
    use_case: FromDishka[ResolveEntityCandidatesUseCase],
) -> ApiResponse[list]:
    try:
        candidates = await use_case.execute(entity_instance_id=str(entity_instance_id))
        return ApiResponse.ok([
            {"entity_instance_id": c.entity_instance_id, "display_name": c.display_name, "rrf_score": c.rrf_score}
            for c in candidates
        ])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=_NOT_FOUND_DETAIL) from exc
```

**Key rules:**
- `dependencies=[Depends(require_api_key)]` on the router (not each endpoint)
- `@inject` decorator from dishka on every handler
- `FromDishka[UseCase]` in function signature — never instantiate directly
- `ValueError` → 404 with `_NOT_FOUND_DETAIL` constant (never expose internal message)
- `UUID` parameter type → Pydantic auto-coerces from path string

---

### `apps/email-listener/app/container.py` (config — modify)

**Analog:** self (add new registrations following the existing `_build_provider()` pattern)

**DI registration pattern** (from container.py lines 30-80):
```python
# In _build_provider():
provider.provide(
    SupabaseEntityInstanceRepository,
    provides=EntityInstanceRepository,
)
provider.provide(SupabaseEntityResolutionRepository)

# Use-cases (auto-wired by dishka):
provider.provide(ConfirmEntityUseCase)
provider.provide(RejectEntityUseCase)
provider.provide(UnmergeEntityUseCase)
provider.provide(ResolveEntityCandidatesUseCase)
```

**Factory function pattern** (when dishka can't auto-wire Optional params):
```python
def _make_resolve_use_case(
    entity_instances: EntityInstanceRepository,
    resolution: SupabaseEntityResolutionRepository,
) -> ResolveEntityCandidatesUseCase:
    return ResolveEntityCandidatesUseCase(
        entity_instances=entity_instances,
        resolution=resolution,
    )

provider.provide(_make_resolve_use_case, provides=ResolveEntityCandidatesUseCase)
```

---

## Shared Patterns

### FastAPI Proxy (Browser Never Holds API Key)
**Source:** `packages/api-client/src/router/_listener-config.ts`
**Apply to:** All tRPC mutation procedures in `entities/mutations.ts`

```typescript
// lines 1-12 of _listener-config.ts
export function getListenerConfig(): { url: string; apiKey: string } {
  const url = process.env.EMAIL_LISTENER_URL;
  const apiKey = process.env.EMAIL_LISTENER_API_KEY;
  if (!url || !apiKey) {
    throw new Error("EMAIL_LISTENER_URL or EMAIL_LISTENER_API_KEY is not configured");
  }
  return { url, apiKey };
}

export async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}
```

**Rules:** `getListenerConfig()` called at request time (not module init). Never `NEXT_PUBLIC_` prefix. Key stays server-side.

---

### Auth Guard (FastAPI)
**Source:** `apps/email-listener/app/presentation/api/v1/components.py` lines 12-16
**Apply to:** `entity_instances.py` router definition

```python
router = APIRouter(
    prefix="/v1/entity-instances",
    tags=["entity-instances"],
    dependencies=[Depends(require_api_key)],
)
```

---

### Optimistic Snapshot/Revert
**Source:** `apps/web/src/app/emails/[id]/_components/use-region-edit.ts` lines 79-107
**Apply to:** `use-entity-curation.ts` for all three curation mutations

```typescript
onMutate: ({ entityInstanceId }) => {
  const prevData = utils.entities.byId.getData({ id: entityId });
  utils.entities.byId.setData({ id: entityId }, (prev) => {
    if (!prev) return prev;
    return { ...prev, /* optimistic update */ };
  });
  return { prevData };
},
onError: (_err, _vars, context) => {
  if (context?.prevData !== undefined) {
    utils.entities.byId.setData({ id: entityId }, context.prevData);
  }
  toast.error("Could not … Try again.");
},
onSuccess: async () => {
  await utils.entities.byId.invalidate({ id: entityId });
  await utils.entities.gallery.invalidate();
  toast.success("…");
},
```

---

### Glass Surface Tokens
**Source:** `apps/web/src/app/_components/inbox-three-pane.tsx` lines 60-65, 110
**Source:** `apps/web/src/app/entity-types/page.tsx` aside header
**Apply to:** All gallery/detail panel headers, aside panel backgrounds

```typescript
// Panel background
className="bg-background/70 backdrop-blur-md"

// Header row
className="flex h-11 items-center border-b border-border/50 bg-background/70 px-3 backdrop-blur-md"

// Active sidebar item
className="bg-primary/10 text-primary"

// Inactive sidebar item
className="text-muted-foreground hover:bg-muted"
```

---

### Tenant Isolation from Data Row
**Source:** `apps/email-listener/app/application/use_cases/confirm_region.py`
**Apply to:** All Python use cases in Phase 10

```python
# ALWAYS derive importer_id from the row, never from the caller
instance = await self._entity_instances.find_by_id(entity_instance_id)
importer_id = instance.importer_id   # D-18/D-21
```

---

### Source Discriminator Filter
**Source:** `packages/api-client/src/router/entities/gallery.ts` (this phase)
**Apply to:** Every Drizzle query and Supabase `.table()` query that touches `entity_instances`

```typescript
// Drizzle
.where(eq(EntityInstances.source, "email_extracted"))

// Supabase Python
.eq("source", "email_extracted")
```

---

### RRF Graceful Degradation
**Source:** `apps/email-listener/app/infrastructure/supabase/retrieval_repository.py`
**Apply to:** `entity_resolution_repository.py` both arms

```python
# Vector arm: exception → log → return []
except Exception:
    logger.exception("entity vector query failed — falling back to lexical arm")
    return []

# If embedding is None (Bedrock unavailable), skip vector arm entirely:
vector_ids = await self._vector_query(...) if embedding else []
```

---

### Structlog Binding
**Source:** `apps/email-listener/app/application/use_cases/confirm_region.py`
**Apply to:** All Python use cases and repository implementations

```python
import structlog
logger = structlog.get_logger(__name__)

# Inside execute():
log = logger.bind(entity_instance_id=entity_instance_id)
log.info("starting operation")
log.warning("edge case encountered", reason="...")
```

---

### Immutable Domain Entity Update
**Source:** `apps/email-listener/app/application/use_cases/confirm_region.py`
**Apply to:** All Phase 10 use case `execute()` methods

```python
# Spread frozen dataclass into new instance (never mutate)
updated = EntityInstance(
    **{**instance.__dict__, "is_active": True},
)
```

---

## No Analog Found

All files have close analogs in the codebase. No files require RESEARCH.md-only patterns.

The two Supabase RPC functions (`match_entities_by_embedding`, `match_entities_by_trgm`) referenced by `entity_resolution_repository.py` must exist as DB functions. Their creation SQL should follow the `match_components_by_embedding` / `match_components_by_trgm` RPCs already in Supabase — search `supabase/migrations/` or the Supabase dashboard for those RPC definitions and clone with table name changed to `entity_instances`.

---

## Metadata

**Analog search scope:** `packages/db/`, `packages/api-client/src/router/`, `apps/web/src/app/`, `apps/email-listener/app/`
**Files scanned:** ~20 analog files read
**Pattern extraction date:** 2026-06-14
