/**
 * form/index.ts — public surface for @nauta/genui/form (Phase 19).
 *
 * The pure, zero-eval declarative form validator + its types. Framework-free.
 */

export {
  validateForm,
  isFieldVisible,
  isFieldRequired,
  type FieldType,
  type FieldCondition,
  type FormFieldOption,
  type FormFieldSpec,
  type FormValue,
  type FormValues,
  type FormValidationResult,
} from "./validate-form";
