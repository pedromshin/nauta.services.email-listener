"use client";

// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that mounts this component (codebase gotcha).
import * as React from "react";
import Link from "next/link";
import { GitMerge } from "lucide-react";

import { api } from "~/trpc/react";

/**
 * ReviewQueueChip (EN-02) — entry point into /entities/review from the
 * entities index header.
 *
 * Renders nothing while loading and nothing when the queue is empty
 * (anti-bloat: no zero-count badge). The count is totalPending from
 * entities.reviewQueue — limit 1 keeps the payload minimal; the count field
 * covers the whole grouped queue regardless of page size.
 */
export function ReviewQueueChip(): React.ReactElement | null {
  const { data } = api.entities.reviewQueue.useQuery({ limit: 1, offset: 0 });

  const count = data?.totalPending ?? 0;
  if (count === 0) return null;

  return (
    <Link
      href="/entities/review"
      aria-label={`Review ${count} proposed merge${count !== 1 ? "s" : ""}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
    >
      <GitMerge className="h-3.5 w-3.5" aria-hidden />
      Review merges
      <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-2xs font-semibold text-background tabular">
        {count}
      </span>
    </Link>
  );
}
