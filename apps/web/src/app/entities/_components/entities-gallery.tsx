"use client";

import {
  Boxes,
  LayoutGrid,
  List,
  Loader2,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@nauta/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@nauta/ui/card";
import { Input } from "@nauta/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nauta/ui/select";
import { Skeleton } from "@nauta/ui/skeleton";

import { api } from "~/trpc/react";

import type { GalleryItem } from "./entities-table";
import { EntitiesMosaic } from "./entities-mosaic";
import { EntitiesTable } from "./entities-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "table" | "mosaic";
type StatusFilter = "confirmed" | "all" | "candidate" | "has-pending-duplicates";
type SortOption = "last_seen" | "name" | "occurrences";

const DEFAULT_STATUS: StatusFilter = "confirmed";
const DEFAULT_SORT: SortOption = "last_seen";
const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function isNonDefaultFilter(
  search: string,
  entityTypeId: string | undefined,
  status: StatusFilter,
  sort: SortOption,
): boolean {
  return (
    search.length > 0 ||
    entityTypeId !== undefined ||
    status !== DEFAULT_STATUS ||
    sort !== DEFAULT_SORT
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TableSkeleton(): React.ReactElement {
  return (
    <div aria-busy="true" aria-label="Loading entities…" className="p-6 space-y-2">
      <Skeleton className="h-9 w-full rounded-md mb-2" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

function MosaicSkeleton(): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Loading entities…"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / Sparse / Error states
// ---------------------------------------------------------------------------

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <Boxes className="h-10 w-10 text-muted-foreground/40 mb-4" aria-hidden />
      <p className="text-sm font-semibold text-foreground">No entities yet</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Entities are built from confirmed regions on your emails. Open an email
        and confirm entity regions to get started.
      </p>
    </div>
  );
}

function SparseState({ onClear }: { readonly onClear: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Search className="h-8 w-8 text-muted-foreground/40 mb-3" aria-hidden />
      <p className="text-sm font-semibold text-foreground">
        No entities match your filters
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Try adjusting the search or filters above.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 text-sm"
        onClick={onClear}
      >
        Clear filters
      </Button>
    </div>
  );
}

function ErrorState(): React.ReactElement {
  return (
    <div className="p-6">
      <Card className="border-destructive" role="alert">
        <CardHeader>
          <CardTitle className="text-destructive text-base">
            Could not load entities
          </CardTitle>
          <CardDescription>
            Unable to fetch the entity list. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main gallery component
// ---------------------------------------------------------------------------

export function EntitiesGallery(): React.ReactElement {
  // View toggle state — default TABLE (D-14)
  const [view, setView] = useState<ViewMode>("table");

  // Filter state
  const [searchRaw, setSearchRaw] = useState("");
  const [entityTypeId, setEntityTypeId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS);
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT);

  // Pagination — accumulated pages
  const [offset, setOffset] = useState(0);
  const [allItems, setAllItems] = useState<ReadonlyArray<GalleryItem>>([]);

  // 300ms debounce on search
  const search = useDebounce(searchRaw, 300);

  // Reset pagination + accumulated items when filters change
  const prevFiltersRef = useRef({ search, entityTypeId, status, sort });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.search !== search ||
      prev.entityTypeId !== entityTypeId ||
      prev.status !== status ||
      prev.sort !== sort
    ) {
      setOffset(0);
      setAllItems([]);
      prevFiltersRef.current = { search, entityTypeId, status, sort };
    }
  }, [search, entityTypeId, status, sort]);

  // tRPC entity types for the type filter
  const entityTypesQuery = api.entityTypes.list.useQuery({ includeInactive: false });

  // tRPC entities list
  const { data, isLoading, isFetching, isError } = api.entities.list.useQuery(
    {
      entityTypeId,
      status,
      search: search.length > 0 ? search : undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    },
  );

  // Append new page items to accumulated list
  useEffect(() => {
    if (data?.items !== undefined && data.items.length > 0) {
      if (offset === 0) {
        setAllItems(data.items as ReadonlyArray<GalleryItem>);
      } else {
        setAllItems((prev) => [
          ...prev,
          ...(data.items as ReadonlyArray<GalleryItem>),
        ]);
      }
    } else if (data?.items !== undefined && offset === 0) {
      setAllItems([]);
    }
  }, [data, offset]);

  const clearFilters = useCallback(() => {
    setSearchRaw("");
    setEntityTypeId(undefined);
    setStatus(DEFAULT_STATUS);
    setSort(DEFAULT_SORT);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (data?.nextOffset !== undefined) {
      setOffset(data.nextOffset);
    }
  }, [data]);

  const nonDefault = useMemo(
    () => isNonDefaultFilter(searchRaw, entityTypeId, status, sort),
    [searchRaw, entityTypeId, status, sort],
  );

  const showEmpty = !isLoading && !isError && allItems.length === 0 && offset === 0;
  const isEmpty = showEmpty && !nonDefault;
  const isSparse = showEmpty && nonDefault;

  return (
    <main
      className="flex flex-col h-full"
      role="main"
      aria-label="Entities gallery"
    >
      {/* Page header */}
      <header className="flex items-center gap-4 border-b px-6 py-4 shrink-0 bg-background/70 backdrop-blur-md border-border/50">
        <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
        <span className="text-sm text-muted-foreground ml-auto">
          {allItems.length > 0 ? `${allItems.length} entities` : null}
        </span>

        {/* View toggle */}
        <div role="group" aria-label="Gallery view" className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Table view"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
            className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${
              view === "table"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <List className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Mosaic view"
            aria-pressed={view === "mosaic"}
            onClick={() => setView("mosaic")}
            className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${
              view === "mosaic"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b px-6 h-11 shrink-0 bg-muted/40 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
          <Input
            type="search"
            aria-label="Search entities"
            placeholder="Search entities…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="h-8 w-64 text-sm pl-8"
          />
        </div>

        {/* Entity type filter */}
        <Select
          value={entityTypeId ?? "__all__"}
          onValueChange={(v) =>
            setEntityTypeId(v === "__all__" ? undefined : v)
          }
        >
          <SelectTrigger
            className="h-8 text-sm w-40"
            aria-label="Filter by entity type"
          >
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {(entityTypesQuery.data ?? []).map((et) => (
              <SelectItem key={et.id} value={et.id}>
                {et.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
        >
          <SelectTrigger
            className="h-8 text-sm w-44"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="candidate">Candidates only</SelectItem>
            <SelectItem value="has-pending-duplicates">Needs review</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as SortOption)}
        >
          <SelectTrigger
            className="h-8 text-sm w-44"
            aria-label="Sort entities"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_seen">Last seen</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="occurrences">Most occurrences</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters — only visible when non-default */}
        {nonDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && offset === 0 ? (
          view === "table" ? (
            <TableSkeleton />
          ) : (
            <MosaicSkeleton />
          )
        ) : isError ? (
          <ErrorState />
        ) : isEmpty ? (
          <EmptyState />
        ) : isSparse ? (
          <SparseState onClear={clearFilters} />
        ) : (
          <>
            {view === "table" ? (
              <EntitiesTable
                items={allItems}
                sort={sort}
                onSortChange={setSort}
              />
            ) : (
              <EntitiesMosaic items={allItems} />
            )}

            {/* Load more */}
            {data?.hasMore === true && (
              <div className="flex justify-center py-6">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Load more entities"
                  onClick={handleLoadMore}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
