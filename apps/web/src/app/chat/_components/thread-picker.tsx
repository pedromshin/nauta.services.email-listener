"use client";

/**
 * thread-picker.tsx — ThreadPickerDialog: a searchable modal palette for
 * picking an email thread to attach as chat context ("IMPROVE EMAIL SELECTION
 * UI IN CHAT CONTEXT SELECTION").
 *
 * The composer's old "From your inbox" affordance was a flat, unsearchable
 * slice(0,20) of subject-only rows buried inside the attach dropdown. This is
 * the richer replacement, mirroring the canvas AddEmailThreadPopover's proven
 * Command composition: a search input plus rows that show the subject, the
 * message count · relative time, and a dimmed snippet line — every field
 * `emails.listThreads` already returns.
 *
 * A CommandDialog (not a Popover) so it never has to nest inside the attach
 * DropdownMenu — the dropdown closes, this opens; cmdk owns keyboard nav
 * without fighting the menu's typeahead. The threads query is `enabled` only
 * while open, so a closed picker costs nothing.
 *
 * DESIGN: a subject is the user's own words → serif + data-evidence (law 2);
 * the count/time/snippet are chrome → sans, faded.
 */

import * as React from "react";

import type { RouterOutputs } from "@polytoken/api-client";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@polytoken/ui/command";

import { api } from "~/trpc/react";

import { formatRelativeTime } from "../_canvas/format-relative-time";

type ThreadListItem = RouterOutputs["emails"]["listThreads"]["items"][number];
type SelectableThread = ThreadListItem & { readonly threadId: string };

/** `latestReceivedAt` may arrive as a hydrated Date (superjson) or a plain
 * string depending on transport — normalize before formatting (same defensive
 * posture as add-email-thread-popover / inbox-thread-group). */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/** Threads with `threadId === null` (pre-backfill singletons) can't be linked. */
function hasThreadId(thread: ThreadListItem): thread is SelectableThread {
  return thread.threadId !== null;
}

export interface ThreadPickerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Fires with the chosen thread's id + resolved subject; the caller attaches
   * it and closes the dialog. */
  readonly onSelect: (threadId: string, subject: string) => void;
}

/**
 * ThreadPickerDialog — searchable inbox-thread picker. Search matches subject
 * and snippet; selecting a row hands the caller the thread id + subject.
 */
export function ThreadPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: ThreadPickerDialogProps): React.ReactElement {
  const query = api.emails.listThreads.useQuery({}, { enabled: open });
  const threads: readonly SelectableThread[] = (query.data?.items ?? []).filter(
    hasThreadId,
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search your threads…" />
      <CommandList>
        <CommandEmpty>
          {query.isPending
            ? "Loading your threads…"
            : query.isError
              ? "Couldn't reach your inbox."
              : "No threads found."}
        </CommandEmpty>
        {threads.map((thread) => {
          const subject = thread.subject ?? "(no subject)";
          return (
            <CommandItem
              key={thread.threadId}
              // cmdk filters on `value` — include the snippet so a search can
              // hit body text, not just the subject.
              value={`${subject} ${thread.latestSnippet ?? ""}`}
              onSelect={() => onSelect(thread.threadId, subject)}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  className="truncate font-serif text-sm text-ink"
                  data-evidence
                >
                  {subject}
                </span>
                <span className="tabular truncate text-2xs text-faded">
                  {thread.messageCount} message
                  {thread.messageCount === 1 ? "" : "s"} ·{" "}
                  {formatRelativeTime(toIsoString(thread.latestReceivedAt))}
                </span>
                {thread.latestSnippet ? (
                  <span className="truncate text-2xs text-faded">
                    {thread.latestSnippet}
                  </span>
                ) : null}
              </div>
            </CommandItem>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
