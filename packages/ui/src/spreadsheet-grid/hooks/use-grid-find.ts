import type { GridApi } from "ag-grid-community";
import { useCallback, useRef, useState } from "react";

/** A cell position matched by the find query */
export interface FindMatch {
  readonly rowIndex: number;
  readonly colId: string;
}

export interface UseGridFindReturn {
  readonly isOpen: boolean;
  readonly query: string;
  readonly matches: readonly FindMatch[];
  readonly currentMatchIndex: number;
  readonly matchCount: number;
  readonly open: () => void;
  readonly close: () => void;
  readonly search: (query: string) => void;
  readonly nextMatch: () => void;
  readonly prevMatch: () => void;
  readonly isMatchCell: (rowIndex: number, colId: string) => boolean;
  readonly isCurrentMatchCell: (rowIndex: number, colId: string) => boolean;
}

/**
 * Find bar state and cell highlight logic for AG Grid Community.
 * Searches all rows and visible columns for matching cell values.
 * Provides navigation between matches via nextMatch/prevMatch.
 */
export function useGridFind(gridApi: GridApi | null): UseGridFindReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<readonly FindMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Scroll to a specific match */
  const scrollToMatch = useCallback(
    (match: FindMatch) => {
      if (!gridApi) return;
      gridApi.ensureIndexVisible(match.rowIndex, "middle");
      gridApi.ensureColumnVisible(match.colId);
    },
    [gridApi],
  );

  const open = useCallback(() => {
    setIsOpen(true);
    // Focus the input after render via microtask
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setMatches([]);
    setCurrentMatch(0);
    // Refresh cell classes to remove highlights
    gridApi?.refreshCells({ force: true });
  }, [gridApi]);

  const search = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);

      if (!gridApi || !newQuery.trim()) {
        setMatches([]);
        setCurrentMatch(0);
        gridApi?.refreshCells({ force: true });
        return;
      }

      const lowerQuery = newQuery.toLowerCase();
      const found: FindMatch[] = [];

      // Get all visible columns (excluding utility columns)
      const cols = gridApi.getAllDisplayedColumns();
      const visibleColIds = cols
        .map((col) => col.getColId())
        .filter((id) => id !== "__row_number__" && id !== "__drag_handle__");

      // Iterate all displayed rows
      gridApi.forEachNodeAfterFilter((rowNode) => {
        if (rowNode.rowIndex === null || rowNode.rowIndex === undefined) return;

        for (const colId of visibleColIds) {
          const value: unknown = rowNode.data
            ? // Try direct field, then nested data object
              ((rowNode.data as Record<string, unknown>)[colId] ??
              (rowNode.data as { data?: Record<string, unknown> }).data?.[
                colId
              ])
            : undefined;

          if (value !== null && value !== undefined) {
            let strVal: string;
            if (typeof value === "object") {
              strVal = JSON.stringify(value);
            } else if (
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean"
            ) {
              strVal = `${value}`;
            } else {
              strVal = "";
            }
            if (strVal.toLowerCase().includes(lowerQuery)) {
              found.push({ rowIndex: rowNode.rowIndex, colId });
            }
          }
        }
      });

      setMatches(found);
      setCurrentMatch(found.length > 0 ? 0 : -1);
      gridApi.refreshCells({ force: true });

      // Scroll to first match
      if (found.length > 0 && found[0]) {
        scrollToMatch(found[0]);
      }
    },
    [gridApi, scrollToMatch],
  );

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentMatch + 1) % matches.length;
    setCurrentMatch(next);
    const match = matches[next];
    if (match) scrollToMatch(match);
    gridApi?.refreshCells({ force: true });
  }, [matches, currentMatch, gridApi, scrollToMatch]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentMatch - 1 + matches.length) % matches.length;
    setCurrentMatch(prev);
    const match = matches[prev];
    if (match) scrollToMatch(match);
    gridApi?.refreshCells({ force: true });
  }, [matches, currentMatch, gridApi, scrollToMatch]);

  const isMatchCell = useCallback(
    (rowIndex: number, colId: string): boolean => {
      if (!query.trim() || matches.length === 0) return false;
      return matches.some((m) => m.rowIndex === rowIndex && m.colId === colId);
    },
    [query, matches],
  );

  const isCurrentMatchCell = useCallback(
    (rowIndex: number, colId: string): boolean => {
      if (currentMatch < 0 || matches.length === 0) return false;
      const current = matches[currentMatch];
      return current?.rowIndex === rowIndex && current?.colId === colId;
    },
    [matches, currentMatch],
  );

  return {
    isOpen,
    query,
    matches,
    currentMatchIndex: currentMatch >= 0 ? currentMatch + 1 : 0,
    matchCount: matches.length,
    open,
    close,
    search,
    nextMatch,
    prevMatch,
    isMatchCell,
    isCurrentMatchCell,
  };
}
