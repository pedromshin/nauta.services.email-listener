"use client";

/**
 * omnibox.tsx — the Cmd/Ctrl+K cross-surface search omnibox (AI-05,
 * search-mode first increment; the verbs/palette mode is a later feature
 * hosted by this same component per FEATURE-CATALOG §AI-05/CI-02).
 *
 * Mounted ONCE in the root layout. Opens on Cmd/Ctrl+K anywhere, queries
 * `search.omnibox` (debounced), and renders results grouped by kind — each
 * row deep-links via its server-provided `href`.
 *
 * Composition: the vendored cmdk primitives (@polytoken/ui/command) inside
 * the vendored Radix Dialog — the same pairing CommandDialog uses, composed
 * directly here because the server already ranked/filtered the results, so
 * cmdk's own client-side filtering must be OFF (`shouldFilter={false}`),
 * and CommandDialog does not forward that prop. Keyboard nav (arrows +
 * Enter) is cmdk's; the focus trap and Escape-to-close are Radix Dialog's.
 *
 * Identity notes (D-58-01): chrome only — monochrome, sans, no earned hue
 * anywhere here. Everything visual rides the vendored primitives' existing
 * token classes.
 *
 * jsdom caveat (repo law): the tests beside this file prove BEHAVIOR only
 * (open/close, grouping, selection navigation) — nothing visual.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@polytoken/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@polytoken/ui/dialog";

import type { RouterOutputs } from "@polytoken/api-client";

import { api } from "~/trpc/react";

export type OmniboxResult =
  RouterOutputs["search"]["omnibox"]["results"][number];

// ---------------------------------------------------------------------------
// Grouping — pure, exported for jsdom testing
// ---------------------------------------------------------------------------

/**
 * Display order + labels. Mirrors OMNIBOX_KIND_ORDER server-side (the server
 * already returns results in this order; this map is what turns the flat
 * list into labelled groups without trusting positional adjacency).
 */
export const OMNIBOX_GROUPS = [
  { kind: "entity", label: "Entities" },
  { kind: "email", label: "Emails" },
  { kind: "conversation", label: "Chats" },
  { kind: "knowledge", label: "Knowledge" },
  { kind: "file", label: "Files" },
] as const satisfies ReadonlyArray<{
  kind: OmniboxResult["kind"];
  label: string;
}>;

export interface OmniboxGroup {
  readonly kind: OmniboxResult["kind"];
  readonly label: string;
  readonly results: ReadonlyArray<OmniboxResult>;
}

/**
 * groupOmniboxResults — buckets a flat result list into OMNIBOX_GROUPS
 * order, dropping empty groups. Pure; never mutates its input.
 */
export function groupOmniboxResults(
  results: ReadonlyArray<OmniboxResult>,
): OmniboxGroup[] {
  return OMNIBOX_GROUPS.map((group) => ({
    ...group,
    results: results.filter((result) => result.kind === group.kind),
  })).filter((group) => group.results.length > 0);
}

// ---------------------------------------------------------------------------
// Result groups — presentational, exported for jsdom testing
// ---------------------------------------------------------------------------

export function OmniboxResultGroups({
  results,
  onSelect,
}: {
  readonly results: ReadonlyArray<OmniboxResult>;
  readonly onSelect: (result: OmniboxResult) => void;
}): React.ReactElement {
  return (
    <>
      {groupOmniboxResults(results).map((group) => (
        <CommandGroup key={group.kind} heading={group.label}>
          {group.results.map((result) => (
            <CommandItem
              key={`${result.kind}:${result.id}`}
              // kind-qualified value keeps cmdk rows unique across groups
              // even when ids collide between kinds (e.g. file names).
              value={`${result.kind}:${result.id}`}
              onSelect={() => onSelect(result)}
            >
              <span className="truncate">{result.title}</span>
              {result.subtitle !== undefined && (
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {result.subtitle}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Debounce — small local hook, no dep
// ---------------------------------------------------------------------------

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Server-side minimum (omniboxSearchInputSchema's .min(2)) — stated once here. */
const MIN_QUERY_CHARS = 2;

// ---------------------------------------------------------------------------
// Omnibox
// ---------------------------------------------------------------------------

/**
 * @param debounceMs — test seam only (jsdom suites pass 0 so a typed query
 * settles inside one macrotask). Production always uses the default.
 */
export function Omnibox({
  debounceMs = 150,
}: {
  readonly debounceMs?: number;
} = {}): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  // Cmd/Ctrl+K toggle — one window-level listener for the app lifetime.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmed = debouncedQuery.trim();
  const enabled = open && trimmed.length >= MIN_QUERY_CHARS;

  const search = api.search.omnibox.useQuery(
    { query: trimmed },
    {
      enabled,
      // Keep the previous page on screen while the next keystroke's results
      // load — an omnibox that blanks between keystrokes reads as flicker.
      placeholderData: (previous) => previous,
      staleTime: 15_000,
    },
  );

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  const handleSelect = React.useCallback(
    (result: OmniboxResult) => {
      setOpen(false);
      setQuery("");
      router.push(result.href);
    },
    [router],
  );

  const results = search.data?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search everything</DialogTitle>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search emails, entities, chats, knowledge, files…"
          />
          <CommandList>
            {trimmed.length < MIN_QUERY_CHARS ? (
              <p
                role="status"
                className="py-6 text-center text-sm text-muted-foreground"
              >
                Type at least {MIN_QUERY_CHARS} characters to search.
              </p>
            ) : search.isError ? (
              <p
                role="status"
                className="py-6 text-center text-sm text-muted-foreground"
              >
                Search failed. Try again.
              </p>
            ) : results.length === 0 ? (
              <p
                role="status"
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {search.isFetching ? "Searching…" : "No results."}
              </p>
            ) : (
              <OmniboxResultGroups results={results} onSelect={handleSelect} />
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
