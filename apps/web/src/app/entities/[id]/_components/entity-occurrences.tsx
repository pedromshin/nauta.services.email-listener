"use client";

import { format } from "date-fns";

import { Badge } from "@polytoken/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@polytoken/ui/card";
import { Skeleton } from "@polytoken/ui/skeleton";

// ---------------------------------------------------------------------------
// Types (matched to entities.byId output shape)
// ---------------------------------------------------------------------------

export interface EntityOccurrence {
  readonly emailId: string;
  readonly emailSubject: string | null;
  readonly receivedAt: Date | null;
  readonly componentId: string;
  readonly componentRole: string | null;
  readonly location: unknown;
  readonly extractionStatus: string;
  readonly matchType: string | null;
}

interface EntityOccurrencesProps {
  readonly occurrences: ReadonlyArray<EntityOccurrence>;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function EntityOccurrencesSkeleton() {
  return <Skeleton className="h-40 w-full" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityOccurrences({ occurrences }: EntityOccurrencesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Occurrences</CardTitle>
      </CardHeader>
      <CardContent>
        {occurrences.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No occurrences recorded for this entity.
          </p>
        ) : (
          <ul className="space-y-2">
            {occurrences.map((occ) => (
              <li
                key={occ.componentId}
                className="flex items-start justify-between gap-2 rounded border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {occ.emailSubject ?? "(no subject)"}
                  </p>
                  {occ.receivedAt !== null && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(occ.receivedAt), "PP")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {occ.componentRole !== null && (
                    <Badge variant="secondary" className="text-xs">
                      {occ.componentRole}
                    </Badge>
                  )}
                  {occ.matchType !== null && (
                    <Badge variant="outline" className="text-xs">
                      {occ.matchType}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
