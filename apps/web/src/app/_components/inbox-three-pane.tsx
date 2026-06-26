"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@nauta/ui/badge";
import { Button } from "@nauta/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@nauta/ui/resizable";
import { Skeleton } from "@nauta/ui/skeleton";

import { api } from "~/trpc/react";

import type { EntityChipEntry } from "./entity-chips";
import { InboxRow, type InboxEmail } from "./inbox-row";

/** The inbox-list projection of an email (a subset of the emails.list row). */
export interface InboxEmailItem extends InboxEmail {
  readonly bodyText: string | null;
  readonly toAddresses: ReadonlyArray<string>;
}

export interface InboxData {
  readonly items: ReadonlyArray<InboxEmailItem>;
  readonly hasMore: boolean;
  readonly nextOffset: number;
}

interface InboxThreePaneProps {
  readonly data: InboxData | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

type InboxFilter = "all" | "unread" | "with-entities";

const PAGE_SIZE = 50;

/** Server-side cap on `emails.entitySummary` input (`emailIds.max(100)`). */
const SUMMARY_BATCH_CAP = 100;

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function FiltersRail({
  filter,
  onFilterChange,
}: {
  readonly filter: InboxFilter;
  readonly onFilterChange: (next: InboxFilter) => void;
}): React.ReactElement {
  const options: ReadonlyArray<{ value: InboxFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "with-entities", label: "With entities" },
  ];

  return (
    <div className="flex h-full flex-col bg-background/70 backdrop-blur-md">
      <div className="flex h-11 items-center border-b border-border/50 px-4 text-sm font-semibold">
        Filters
      </div>
      <nav className="flex flex-col gap-1 p-2" aria-label="Inbox filters">
        {options.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(option.value)}
              className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ReadingPreview({
  email,
}: {
  readonly email: InboxEmailItem | null;
}): React.ReactElement {
  if (!email) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background/70 p-12 text-center backdrop-blur-md">
        <p className="text-sm font-semibold">No email selected</p>
        <p className="text-sm text-muted-foreground">
          Select a message from the list to preview it here.
        </p>
      </div>
    );
  }

  const sender = email.senderName
    ? `${email.senderName} <${email.senderAddress}>`
    : email.senderAddress;

  return (
    <div className="flex h-full flex-col bg-background/70 backdrop-blur-md">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/50 px-4 py-2">
        <span className="truncate text-sm font-semibold">
          {email.subject ?? "(no subject)"}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link href={`/emails/${email.id}`}>Open editor →</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 overflow-auto p-4">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">{sender}</span>
          <span className="text-muted-foreground">
            To: {email.toAddresses.join(", ") || "—"}
          </span>
        </div>

        {email.bodyText ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">
            {email.bodyText.slice(0, 2000)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This email has no plain-text body. Open the editor to view the full
            document and its regions.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * InboxThreePane (D-22) — a resizable, glassy three-pane Gmail-style inbox:
 * filters rail · message list · reading preview. The seed page comes from the
 * page-level emails.list query (passed in); "Load more" appends further pages
 * via the same query (hasMore / nextOffset preserved verbatim). Per-email entity
 * chips come from a SINGLE batched emails.entitySummary call keyed by the visible
 * page of email ids — never a per-row fetch (D-23).
 */
export function InboxThreePane({
  data,
  isLoading,
  isError,
}: InboxThreePaneProps): React.ReactElement {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Accumulated extra pages fetched via Load-more, appended after the seed page.
  const [extraItems, setExtraItems] = useState<ReadonlyArray<InboxEmailItem>>(
    [],
  );
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  // Memoized so the reference is stable across renders. Without useMemo,
  // `data?.items ?? []` mints a fresh array every render whenever `data` is
  // undefined (loading or error state), which makes the reset effect below —
  // keyed on [seedItems] — fire on every render and call setState in a loop
  // ("Maximum update depth exceeded"). With memoization the dependency only
  // changes when a genuinely new seed page arrives.
  const seedItems = useMemo<ReadonlyArray<InboxEmailItem>>(
    () => data?.items ?? [],
    [data?.items],
  );

  // Reset accumulated pages whenever the seed page identity changes.
  useEffect(() => {
    setExtraItems([]);
    setNextOffset(null);
  }, [seedItems]);

  const allItems = useMemo<ReadonlyArray<InboxEmailItem>>(
    () => [...seedItems, ...extraItems],
    [seedItems, extraItems],
  );

  // Batched entity rollup for the visible page (single query, never per-row).
  // Capped at the server-side batch limit: emails.entitySummary validates
  // `emailIds` with .max(100), so an unbounded list (3+ pages loaded = 150 ids)
  // would throw a Zod error and wipe entity chips for the ENTIRE inbox. Chips
  // beyond the first 100 loaded emails are omitted rather than crashing.
  const emailIds = useMemo(
    () => allItems.slice(0, SUMMARY_BATCH_CAP).map((item) => item.id),
    [allItems],
  );
  const entitySummaryQuery = api.emails.entitySummary.useQuery(
    { emailIds: emailIds as string[] },
    { enabled: emailIds.length > 0 },
  );

  const entitiesByEmailId = useMemo(() => {
    const map = new Map<string, ReadonlyArray<EntityChipEntry>>();
    for (const entry of entitySummaryQuery.data ?? []) {
      map.set(entry.emailId, entry.entities);
    }
    return map;
  }, [entitySummaryQuery.data]);

  const withEntities = useMemo(
    () => allItems.filter((item) => (entitiesByEmailId.get(item.id)?.length ?? 0) > 0),
    [allItems, entitiesByEmailId],
  );

  const visibleItems =
    filter === "with-entities" ? withEntities : allItems;

  // Default-select the first visible item once data is available.
  useEffect(() => {
    if (selectedEmailId === null && visibleItems.length > 0) {
      setSelectedEmailId(visibleItems[0]!.id);
    }
  }, [selectedEmailId, visibleItems]);

  // Load-more — append the next page via emails.list, preserving hasMore paging.
  const loadMoreOffset = nextOffset ?? data?.nextOffset ?? seedItems.length;
  const loadMoreQuery = api.emails.list.useQuery(
    { limit: PAGE_SIZE, offset: loadMoreOffset },
    { enabled: false },
  );

  const hasMore =
    nextOffset === null ? (data?.hasMore ?? false) : loadMoreQuery.data?.hasMore ?? false;

  const handleLoadMore = async (): Promise<void> => {
    const result = await loadMoreQuery.refetch();
    const page = result.data;
    if (!page) return;
    setExtraItems((prev) => [...prev, ...(page.items as InboxEmailItem[])]);
    setNextOffset(page.nextOffset);
  };

  const selectedEmail =
    visibleItems.find((item) => item.id === selectedEmailId) ?? null;

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={18} minSize={14}>
        <FiltersRail filter={filter} onFilterChange={setFilter} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={42} minSize={28}>
        <div className="flex h-full flex-col bg-background/70 backdrop-blur-md">
          <div className="flex h-11 items-center justify-between border-b border-border/50 px-4">
            <span className="text-sm font-semibold">Inbox</span>
            {data && (
              <Badge variant="secondary">{visibleItems.length}</Badge>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading && (
              <div className="space-y-2 p-4">
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            )}

            {isError && (
              <div className="p-6 text-center text-sm text-destructive">
                Unable to load emails. Please try refreshing the page.
              </div>
            )}

            {data && visibleItems.length === 0 && !isLoading && (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {filter === "with-entities"
                  ? "No emails with extracted entities yet."
                  : "No emails yet."}
              </div>
            )}

            {visibleItems.map((item) => (
              <InboxRow
                key={item.id}
                email={item}
                entities={entitiesByEmailId.get(item.id) ?? []}
                isSelected={item.id === selectedEmailId}
                onSelect={setSelectedEmailId}
              />
            ))}

            {hasMore && filter !== "with-entities" && (
              <div className="p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={loadMoreQuery.isFetching}
                  onClick={() => void handleLoadMore()}
                >
                  {loadMoreQuery.isFetching ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={40}>
        <ReadingPreview email={selectedEmail} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
