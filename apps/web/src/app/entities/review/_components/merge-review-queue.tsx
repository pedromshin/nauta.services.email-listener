"use client";

// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that mounts this component (codebase gotcha).
import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@polytoken/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@polytoken/ui/card";
import { Skeleton } from "@polytoken/ui/skeleton";

import { api } from "~/trpc/react";

import type { ReviewPair } from "./review-pair-card";
import { ReviewPairCard } from "./review-pair-card";
import { useMergeReview } from "./use-merge-review";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function QueueSkeleton(): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Loading merge review queue…"
      className="space-y-4 p-6"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-xl" />
      ))}
    </div>
  );
}

function QueueClearState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <CheckCircle2
        className="mb-4 h-10 w-10 text-muted-foreground/40"
        aria-hidden
      />
      <p className="text-sm font-semibold text-foreground">Queue clear</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        No duplicate suggestions are waiting for review. New pairs appear here
        as entities are extracted from your mail.
      </p>
      <Button asChild variant="ghost" size="sm" className="mt-3 text-sm">
        <Link href="/entities">Back to entities</Link>
      </Button>
    </div>
  );
}

function AllSkippedState({
  skippedCount,
  onReset,
}: {
  readonly skippedCount: number;
  readonly onReset: () => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-sm font-semibold text-foreground">
        Nothing left on this page
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        You skipped {skippedCount} pair{skippedCount !== 1 ? "s" : ""} — they
        stay pending until merged or rejected.
      </p>
      <Button variant="ghost" size="sm" className="mt-3 text-sm" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Show skipped pairs
      </Button>
    </div>
  );
}

function QueueErrorState(): React.ReactElement {
  return (
    <div className="p-6">
      <Card className="border-destructive" role="alert">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Could not load the review queue
          </CardTitle>
          <CardDescription>
            Unable to fetch pending merge suggestions. Please try refreshing
            the page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

/**
 * MergeReviewQueue (EN-02) — the human gate over AI-proposed entity merges.
 *
 * Reads entities.reviewQueue (all owned entities, paginated); Merge/Reject
 * act through useMergeReview, which calls the EXISTING confirmMerge /
 * rejectMerge procedures with optimistic cache updates. Skip is local-only —
 * a skipped pair stays pending server-side.
 */
export function MergeReviewQueue(): React.ReactElement {
  const [offset, setOffset] = useState(0);
  const queueInput = useMemo(
    () => ({ limit: PAGE_SIZE, offset }),
    [offset],
  );

  const { data, isLoading, isFetching, isError } =
    api.entities.reviewQueue.useQuery(queueInput);

  const { merge, reject, busyPairs } = useMergeReview(queueInput);

  // Skip — session-local only; no write (a skipped pair stays pending).
  const [skippedKeys, setSkippedKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const skip = useCallback((pair: ReviewPair) => {
    setSkippedKeys((prev) => new Set([...prev, pair.pairKey]));
  }, []);
  const resetSkipped = useCallback(() => {
    setSkippedKeys(new Set());
  }, []);

  const items = (data?.items ?? []) as ReadonlyArray<ReviewPair>;
  const visibleItems = items.filter((p) => !skippedKeys.has(p.pairKey));
  const skippedOnPage = items.length - visibleItems.length;
  const totalPending = data?.totalPending ?? 0;

  return (
    <main
      className="flex h-full flex-col"
      role="main"
      aria-label="Merge review queue"
    >
      {/* Page header */}
      <header className="flex shrink-0 items-center gap-4 border-b border-border/50 bg-background/95 px-6 py-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Link href="/entities" aria-label="Back to entities">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Entities
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Merge review</h1>
        <span className="ml-auto text-sm text-muted-foreground tabular">
          {totalPending > 0
            ? `${totalPending} pair${totalPending !== 1 ? "s" : ""} pending`
            : null}
        </span>
      </header>

      {/* Queue body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <QueueSkeleton />
        ) : isError ? (
          <QueueErrorState />
        ) : items.length === 0 && offset === 0 ? (
          <QueueClearState />
        ) : visibleItems.length === 0 ? (
          <AllSkippedState skippedCount={skippedOnPage} onReset={resetSkipped} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 p-6">
            {visibleItems.map((pair) => (
              <ReviewPairCard
                key={pair.pairKey}
                pair={pair}
                busy={busyPairs.has(pair.pairKey)}
                busyAction={busyPairs.get(pair.pairKey) ?? null}
                onMerge={merge}
                onReject={reject}
                onSkip={skip}
              />
            ))}

            {/* Pagination over grouped pairs */}
            {(data?.hasMore === true || offset > 0) && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || isFetching}
                  onClick={() =>
                    setOffset((prev) => Math.max(0, prev - PAGE_SIZE))
                  }
                >
                  Previous
                </Button>
                {isFetching && (
                  <Loader2
                    className="h-4 w-4 animate-spin text-muted-foreground"
                    aria-label="Loading page"
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data?.hasMore !== true || isFetching}
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
