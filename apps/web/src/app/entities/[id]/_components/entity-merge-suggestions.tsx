"use client";

import { Check, Loader2, X } from "lucide-react";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@polytoken/ui/card";
import { Skeleton } from "@polytoken/ui/skeleton";

import { RejectMergeDialog } from "./reject-merge-dialog";

// ---------------------------------------------------------------------------
// Types (matched to entities.byId pendingSuggestions shape)
// ---------------------------------------------------------------------------

export interface MergeSuggestion {
  readonly entityInstanceId: string;
  readonly displayName: string;
  readonly entityTypeId: string;
  readonly entityTypeLabel: string | null;
  readonly keyIdentifiers: Record<string, unknown>;
  readonly matchTypes: ReadonlyArray<string>;
  readonly occurrenceCount: number;
}

// ---------------------------------------------------------------------------
// Callback props
// ---------------------------------------------------------------------------

interface EntityMergeSuggestionsProps {
  readonly suggestions: ReadonlyArray<MergeSuggestion>;
  readonly onConfirm: (entityInstanceId: string) => void;
  readonly onReject: (entityInstanceId: string) => void;
  readonly confirmingIds: ReadonlySet<string>;
  readonly rejectingIds: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function EntityMergeSuggestionsSkeleton() {
  return <Skeleton className="h-32 w-full" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityMergeSuggestions({
  suggestions,
  onConfirm,
  onReject,
  confirmingIds,
  rejectingIds,
}: EntityMergeSuggestionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Merge Suggestions</CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No merge suggestions pending.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const isConfirming = confirmingIds.has(s.entityInstanceId);
              const isRejecting = rejectingIds.has(s.entityInstanceId);
              const isBusy = isConfirming || isRejecting;

              return (
                <li
                  key={s.entityInstanceId}
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2"
                  aria-busy={isBusy}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.displayName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {s.entityTypeLabel ?? s.entityTypeId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        &middot; {s.occurrenceCount} occurrence
                        {s.occurrenceCount !== 1 ? "s" : ""}
                      </span>
                      {s.matchTypes.map((mt) => (
                        <Badge key={mt} variant="secondary" className="text-xs">
                          {mt}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* Confirm button */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      aria-label={`Confirm merge with ${s.displayName}`}
                      onClick={() => onConfirm(s.entityInstanceId)}
                    >
                      {isConfirming ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>

                    {/* Reject button (with dialog) */}
                    <RejectMergeDialog
                      onConfirm={() => onReject(s.entityInstanceId)}
                      disabled={isBusy}
                    >
                      {isRejecting ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </RejectMergeDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
