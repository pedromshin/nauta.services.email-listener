"use client";

// Explicit React import (not just named hook imports) — this file's JSX
// compiles fine under Next.js's SWC automatic JSX runtime, but vitest's
// plain esbuild transform defaults to the classic runtime
// (React.createElement) and needs `React` in scope whenever a test mounts
// this component (mirrors genui-panel-node.tsx's identical note — found
// live, 53-03-PLAN.md Task 1, inbox-mobile-stack.test.tsx).
import * as React from "react";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@polytoken/ui/badge";

import type { EntityChipEntry } from "./entity-chips";
import { InboxRow, type InboxEmail } from "./inbox-row";

interface InboxThreadGroupProps {
  /** Latest member's subject (server-computed by emails.listThreads). */
  readonly subject: string | null;
  readonly messageCount: number;
  readonly latestReceivedAt: Date | string | null;
  readonly latestSnippet: string | null;
  /**
   * Resolved member email rows, most-recent-first (already capped upstream
   * by the server's memberEmailIds cap — 45-UI-SPEC "Data contract"). May be
   * a strict subset of `messageCount` if the client-side email lookup hasn't
   * resolved every id yet.
   */
  readonly members: ReadonlyArray<InboxEmail>;
  readonly entitiesByEmailId: ReadonlyMap<string, ReadonlyArray<EntityChipEntry>>;
  readonly selectedEmailId: string | null;
  readonly onSelectMember: (emailId: string) => void;
}

const formatDate = (value: Date | string | null): string =>
  value ? new Date(value).toLocaleDateString() : "—";

/**
 * InboxThreadGroup (THRD-03, 45-UI-SPEC) — one thread entry in the inbox's
 * middle pane.
 *
 * Count-1 threads (including pre-backfill singleton orphans) render as a
 * flat `InboxRow`, identical to the pre-thread-grouping inbox — no
 * disclosure chrome (per the UI-SPEC's "no visual noise for the common
 * case"). Count>1 threads render a summary row (subject + count Badge +
 * latest snippet/date) that expands, via a local `useState` toggle (zero new
 * dependency, T-45-04-SC), to reveal its member emails through the EXISTING
 * `InboxRow` component — unmodified, so selecting a member still drives the
 * reading preview / "Open editor →" exactly as it does today.
 */
export function InboxThreadGroup({
  subject,
  messageCount,
  latestReceivedAt,
  latestSnippet,
  members,
  entitiesByEmailId,
  selectedEmailId,
  onSelectMember,
}: InboxThreadGroupProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  // Singleton thread: identical to the pre-grouping inbox row. If the member
  // row hasn't resolved yet (client-side lookup still loading), render
  // nothing rather than a broken/partial row — the parent's loading gate
  // normally prevents this, but stay defensive.
  if (messageCount <= 1) {
    const only = members[0];
    if (!only) return null;
    return (
      <InboxRow
        email={only}
        entities={entitiesByEmailId.get(only.id) ?? []}
        isSelected={only.id === selectedEmailId}
        onSelect={onSelectMember}
      />
    );
  }

  return (
    <div className="border-b border-border/50">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex min-h-16 w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            aria-hidden
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
          <span className="flex-1 truncate text-sm font-semibold">
            {subject ?? "(no subject)"}
          </span>
          <Badge variant="secondary">{messageCount}</Badge>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(latestReceivedAt)}
          </span>
        </div>

        {latestSnippet && (
          <span className="truncate pl-6 text-sm text-muted-foreground">
            {latestSnippet}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/30 pl-4">
          {members.map((member) => (
            <InboxRow
              key={member.id}
              email={member}
              entities={entitiesByEmailId.get(member.id) ?? []}
              isSelected={member.id === selectedEmailId}
              onSelect={onSelectMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
