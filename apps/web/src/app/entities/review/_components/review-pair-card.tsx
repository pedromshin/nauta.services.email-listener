"use client";

// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for any suite that mounts this component (codebase gotcha).
import * as React from "react";
import Link from "next/link";
import { Check, Loader2, SkipForward, X } from "lucide-react";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@polytoken/ui/card";

// ---------------------------------------------------------------------------
// Types — matched to entities.reviewQueue item shape (review.ts ReviewPair)
// ---------------------------------------------------------------------------

export interface ReviewPairEntity {
  readonly id: string;
  readonly displayName: string;
  readonly entityTypeId: string;
  readonly entityTypeLabel: string | null;
  readonly aliases: ReadonlyArray<string>;
  readonly identifiers: Record<string, unknown>;
  readonly occurrenceCount: number;
}

export interface ReviewPair {
  readonly pairKey: string;
  readonly subject: ReviewPairEntity;
  readonly candidate: ReviewPairEntity;
  readonly matchTypes: ReadonlyArray<string>;
  readonly maxSimilarity: number | null;
  readonly linkCount: number;
  readonly sharedAliases: ReadonlyArray<string>;
  readonly sharedIdentifierKeys: ReadonlyArray<string>;
}

interface ReviewPairCardProps {
  readonly pair: ReviewPair;
  readonly busy: boolean;
  readonly busyAction: "merge" | "reject" | null;
  /** Merge candidate INTO subject (subject survives). */
  readonly onMerge: (pair: ReviewPair) => void;
  /** Reject the suggestion (durable negative example, D-20). */
  readonly onReject: (pair: ReviewPair) => void;
  /** Hide this pair for the session only — no write. */
  readonly onSkip: (pair: ReviewPair) => void;
}

// ---------------------------------------------------------------------------
// One side of the compare card
// ---------------------------------------------------------------------------

function EntityColumn({
  entity,
  roleLabel,
}: {
  readonly entity: ReviewPairEntity;
  readonly roleLabel: string;
}): React.ReactElement {
  const identifierEntries = Object.entries(entity.identifiers).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim().length > 0,
  );

  return (
    <div className="min-w-0 flex-1 space-y-2">
      {/* Chrome: role + type speak sans (law 2). */}
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">
        {roleLabel}
        {entity.entityTypeLabel !== null && (
          <span> · {entity.entityTypeLabel}</span>
        )}
      </p>

      {/* The entity's name is the user's own material — serif (law 2). */}
      <Link
        href={`/entities/${entity.id}`}
        className="block truncate text-base font-medium hover:underline"
      >
        <span data-evidence className="font-serif">
          {entity.displayName}
        </span>
      </Link>

      <p className="text-xs text-muted-foreground tabular">
        {entity.occurrenceCount} email
        {entity.occurrenceCount !== 1 ? "s" : ""}
      </p>

      {entity.aliases.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-2xs text-muted-foreground">Aliases</p>
          <ul className="space-y-0.5">
            {entity.aliases.slice(0, 4).map((alias) => (
              <li key={alias} className="truncate text-xs">
                <span data-evidence className="font-serif">
                  {alias}
                </span>
              </li>
            ))}
            {entity.aliases.length > 4 && (
              <li className="text-2xs text-muted-foreground">
                +{entity.aliases.length - 4} more
              </li>
            )}
          </ul>
        </div>
      )}

      {identifierEntries.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-2xs text-muted-foreground">Identifiers</p>
          <ul className="space-y-0.5">
            {identifierEntries.slice(0, 4).map(([key, value]) => (
              <li key={key} className="truncate text-xs">
                <span className="text-muted-foreground">{key}: </span>
                <span data-evidence className="font-serif tabular">
                  {String(value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pair card
// ---------------------------------------------------------------------------

/**
 * ReviewPairCard (EN-02) — one AI-proposed duplicate pair, side by side.
 *
 * Purely presentational; all writes go through the callbacks (the queue's
 * hook calls the EXISTING entities.confirmMerge / entities.rejectMerge
 * procedures). Actions are labeled — not bare icon rows (taste checklist).
 * Reject/Merge are plain ink controls: the operation is undoable server-side
 * (unmerge exists; a dismissal is a preference, not data loss), so no madder.
 */
export function ReviewPairCard({
  pair,
  busy,
  busyAction,
  onMerge,
  onReject,
  onSkip,
}: ReviewPairCardProps): React.ReactElement {
  const similarityPct =
    pair.maxSimilarity !== null
      ? `${Math.round(pair.maxSimilarity * 100)}%`
      : null;

  return (
    <Card aria-busy={busy} data-pair-key={pair.pairKey}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Proposed duplicate
          </span>
          {similarityPct !== null && (
            <span className="text-xs text-muted-foreground tabular">
              {similarityPct} similar
            </span>
          )}
          {pair.matchTypes.map((mt) => (
            <Badge key={mt} variant="secondary" className="text-2xs">
              {mt}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Side-by-side compare */}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <EntityColumn entity={pair.subject} roleLabel="Keep" />
          <div
            aria-hidden
            className="hidden w-px shrink-0 self-stretch bg-border sm:block"
          />
          <EntityColumn entity={pair.candidate} roleLabel="Merge in" />
        </div>

        {/* Shared evidence strip */}
        {(pair.sharedAliases.length > 0 ||
          pair.sharedIdentifierKeys.length > 0) && (
          <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2">
            <p className="text-2xs text-muted-foreground">Shared evidence</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {pair.sharedAliases.map((alias) => (
                <span key={alias} className="text-xs">
                  <span data-evidence className="font-serif">
                    {alias}
                  </span>
                </span>
              ))}
              {pair.sharedIdentifierKeys.map((key) => (
                <span key={key} className="text-xs text-muted-foreground">
                  same {key}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          size="sm"
          disabled={busy}
          aria-label={`Merge ${pair.candidate.displayName} into ${pair.subject.displayName}`}
          onClick={() => onMerge(pair)}
        >
          {busy && busyAction === "merge" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          Merge
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          aria-label={`Reject merge of ${pair.candidate.displayName} and ${pair.subject.displayName}`}
          onClick={() => onReject(pair)}
        >
          {busy && busyAction === "reject" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden />
          )}
          Reject
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={`Skip ${pair.subject.displayName} for now`}
          className="ml-auto text-muted-foreground"
          onClick={() => onSkip(pair)}
        >
          <SkipForward className="h-3.5 w-3.5" aria-hidden />
          Skip
        </Button>
      </CardFooter>
    </Card>
  );
}
