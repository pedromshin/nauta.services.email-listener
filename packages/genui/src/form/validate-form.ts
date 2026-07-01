/**
 * validate-form.ts — the pure, ZERO-EVAL validator for the declarative `form` node (Phase 19).
 *
 * Deliberately does NOT use AJV: AJV compiles model-provided JSON Schema into validation code via
 * `new Function`, which would break the declarative core's no-eval invariant (GR-01 / D-24) — the
 * exact property that makes the hybrid's "reliable core" reliable. Instead this is a bounded,
 * framework-free validator over a typed field-spec. Regex patterns use `new RegExp` (construction,
 * not eval) with a length guard against pathological (ReDoS) input.
 *
 * FORM-02 (conditional logic) + FORM-03 (declarative validation), both as DATA not code.
 */

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "tel"
  | "url"
  | "password"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio";

/** A cross-field condition (data, not code): true when `values[field] === equals`. */
export interface FieldCondition {
  readonly field: string;
  readonly equals: string | number | boolean;
}

export interface FormFieldOption {
  readonly label: string;
  readonly value: string;
}

export interface FormFieldSpec {
  readonly name: string;
  readonly label: string;
  readonly fieldType?: FieldType;
  readonly required?: boolean;
  readonly options?: readonly FormFieldOption[];
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly visibleWhen?: FieldCondition;
  readonly requiredWhen?: FieldCondition;
  // Display-only fields (ignored by the validator; consumed by the renderer).
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly defaultValue?: string | number | boolean;
}

export type FormValue = string | number | boolean | undefined;
export type FormValues = Readonly<Record<string, FormValue>>;

export interface FormValidationResult {
  readonly valid: boolean;
  readonly errors: Readonly<Record<string, string>>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[+(]?[\d][\d\s().-]{4,}$/;
/** ReDoS guard — skip user-pattern testing on very long values. */
const MAX_PATTERN_INPUT = 2000;

function conditionMet(cond: FieldCondition, values: FormValues): boolean {
  return values[cond.field] === cond.equals;
}

/** A field is shown unless its `visibleWhen` condition is unmet. */
export function isFieldVisible(field: FormFieldSpec, values: FormValues): boolean {
  return field.visibleWhen ? conditionMet(field.visibleWhen, values) : true;
}

/** A field is required if `required` or its `requiredWhen` condition is met. */
export function isFieldRequired(field: FormFieldSpec, values: FormValues): boolean {
  if (field.required) return true;
  return field.requiredWhen ? conditionMet(field.requiredWhen, values) : false;
}

function isEmpty(value: FormValue, fieldType: FieldType): boolean {
  if (fieldType === "checkbox") return value !== true;
  return value === undefined || value === null || value === "";
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function patternError(field: FormFieldSpec, value: string): string | null {
  if (field.pattern === undefined || value.length > MAX_PATTERN_INPUT) return null;
  let re: RegExp;
  try {
    re = new RegExp(field.pattern); // construction only — not eval/Function
  } catch {
    return null; // invalid pattern from the model → do not block the user
  }
  return re.test(value) ? null : `${field.label} is not in the expected format.`;
}

function lengthError(field: FormFieldSpec, value: string): string | null {
  if (field.minLength !== undefined && value.length < field.minLength) {
    return `${field.label} must be at least ${field.minLength} characters.`;
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    return `${field.label} must be at most ${field.maxLength} characters.`;
  }
  return null;
}

function validateField(field: FormFieldSpec, raw: FormValue): string | null {
  const fieldType = field.fieldType ?? "text";
  const strVal = typeof raw === "string" ? raw : String(raw);

  switch (fieldType) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(strVal);
      if (Number.isNaN(n)) return `${field.label} must be a number.`;
      if (field.min !== undefined && n < field.min) return `${field.label} must be at least ${field.min}.`;
      if (field.max !== undefined && n > field.max) return `${field.label} must be at most ${field.max}.`;
      return null;
    }
    case "email":
      return EMAIL_RE.test(strVal) ? null : `${field.label} must be a valid email address.`;
    case "url":
      return isValidUrl(strVal) ? null : `${field.label} must be a valid URL.`;
    case "tel":
      return TEL_RE.test(strVal) ? null : `${field.label} must be a valid phone number.`;
    case "select":
    case "radio":
      if (field.options && !field.options.some((o) => o.value === strVal)) {
        return `${field.label} has an invalid selection.`;
      }
      return null;
    case "checkbox":
      return null; // presence already handled; a checked box is always valid
    case "text":
    case "textarea":
    case "password":
    default:
      return lengthError(field, strVal) ?? patternError(field, strVal);
  }
}

/**
 * Validate all visible fields against the current values. Hidden fields (failed `visibleWhen`)
 * are skipped entirely. Returns an errors map keyed by field name; `valid` is true iff empty.
 */
export function validateForm(
  fields: readonly FormFieldSpec[],
  values: FormValues,
): FormValidationResult {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (!isFieldVisible(field, values)) continue;

    const raw = values[field.name];
    const fieldType = field.fieldType ?? "text";

    if (isEmpty(raw, fieldType)) {
      if (isFieldRequired(field, values)) errors[field.name] = `${field.label} is required.`;
      continue; // no further checks on an empty (optional) field
    }

    const error = validateField(field, raw);
    if (error) errors[field.name] = error;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
