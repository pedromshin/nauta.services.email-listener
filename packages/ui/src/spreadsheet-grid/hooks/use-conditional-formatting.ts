import type { CellClassParams } from "ag-grid-community";
import { useCallback } from "react";

import type {
  FormatColor,
  FormatCondition,
  FormatRule,
  FormattingRules,
  SpreadsheetRow,
} from "../types";

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

/** Evaluate a single rule against a cell value. Returns true if the rule matches. */
function evaluateRule(rule: FormatRule, value: unknown): boolean {
  const condition: FormatCondition = rule.condition;

  switch (condition) {
    case "greater_than":
      return Number(value) > Number(rule.value);
    case "less_than":
      return Number(value) < Number(rule.value);
    case "equals":
      return String(value) === String(rule.value);
    case "not_equals":
      return String(value) !== String(rule.value);
    case "contains":
      return String(value)
        .toLowerCase()
        .includes(String(rule.value).toLowerCase());
    case "not_contains":
      return !String(value)
        .toLowerCase()
        .includes(String(rule.value).toLowerCase());
    case "not_empty":
      return value !== null && value !== undefined && value !== "";
    case "is_empty":
      return value === null || value === undefined || value === "";
    default:
      return false;
  }
}

/** CSS class for a given chart color */
function colorClass(color: FormatColor): string {
  return `cf-${color}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseConditionalFormattingReturn {
  /**
   * Returns the CSS class (e.g. "cf-chart-3") for the first matching rule on
   * this column, or undefined if no rule matches.
   */
  getCellClass: (columnName: string, value: unknown) => string | undefined;
  /**
   * Returns an AG Grid cellClassRules map for a given column.
   * Only includes entries for colors that have at least one rule on this column.
   */
  buildCellClassRules: (
    columnName: string,
  ) => Record<string, (params: CellClassParams<SpreadsheetRow>) => boolean>;
}

export function useConditionalFormatting(
  rules: FormattingRules,
): UseConditionalFormattingReturn {
  const getCellClass = useCallback(
    (columnName: string, value: unknown): string | undefined => {
      const columnRules = rules[columnName];
      if (!columnRules || columnRules.length === 0) return undefined;

      for (const rule of columnRules) {
        if (evaluateRule(rule, value)) {
          return colorClass(rule.color);
        }
      }
      return undefined;
    },
    [rules],
  );

  const buildCellClassRules = useCallback(
    (
      columnName: string,
    ): Record<string, (params: CellClassParams<SpreadsheetRow>) => boolean> => {
      const columnRules = rules[columnName];
      if (!columnRules || columnRules.length === 0) return {};

      // Collect colors used by this column's rules (in rule order — first match wins)
      const usedColors = new Set(columnRules.map((r) => r.color));

      const cellClassRules: Record<
        string,
        (params: CellClassParams<SpreadsheetRow>) => boolean
      > = {};

      for (const color of usedColors) {
        const cssClass = colorClass(color);
        cellClassRules[cssClass] = (
          params: CellClassParams<SpreadsheetRow>,
        ) => {
          const data = params.data;
          if (!data) return false;
          const value: unknown = data.data[columnName];

          // Find first matching rule for this column
          const matchingRule = columnRules.find((r) => evaluateRule(r, value));
          // Apply this color class only if the first match uses this color
          return matchingRule?.color === color;
        };
      }

      return cellClassRules;
    },
    [rules],
  );

  return { getCellClass, buildCellClassRules };
}
