import type { SpreadsheetColumn } from "./types";

export interface ValidationResult {
  readonly valid: boolean;
  readonly message: string | null;
}

/** Validates a cell value against its column schema definition (D-04) */
export function validateCellValue(
  value: unknown,
  column: SpreadsheetColumn,
): ValidationResult {
  // Required field check
  if (
    column.required &&
    (value === null || value === undefined || value === "")
  ) {
    return { valid: false, message: `${column.name} is required` };
  }

  // Skip validation for null/empty optional fields
  if (value === null || value === undefined || value === "") {
    return { valid: true, message: null };
  }

  // Type-specific validation
  switch (column.type) {
    case "number":
      if (typeof value === "string" && isNaN(Number(value))) {
        return { valid: false, message: "Must be a number" };
      }
      break;
    case "email":
      if (typeof value === "string" && !value.includes("@")) {
        return { valid: false, message: "Must be a valid email address" };
      }
      break;
    case "url":
      try {
        new URL(typeof value === "string" ? value : JSON.stringify(value));
      } catch {
        return { valid: false, message: "Must be a valid URL" };
      }
      break;
    case "date":
      if (isNaN(Date.parse(typeof value === "string" ? value : ""))) {
        return { valid: false, message: "Must be a valid date" };
      }
      break;
    case "enum":
      if (
        column.enumValues &&
        !column.enumValues.includes(typeof value === "string" ? value : "")
      ) {
        return {
          valid: false,
          message: `Must be one of: ${column.enumValues.join(", ")}`,
        };
      }
      break;
    default:
      break;
  }

  return { valid: true, message: null };
}
