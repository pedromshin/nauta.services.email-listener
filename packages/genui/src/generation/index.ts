/**
 * generation/index.ts — Barrel for @nauta/genui generation module.
 *
 * Exports:
 *   - ALLOWED_PROCEDURES (procedure allowlist re-export for Python artifact)
 *   - AllowedProcedureSchema
 *   - ARTIFACT_DIR / SPEC_SCHEMA_PATH / GENUI_PROMPT_PATH — path constants (D-03)
 *   - buildGenuiPromptPayload() — pure function shared by emit script + freshness test
 *   - buildSpecSchema() — converts SpecRootSchema to Bedrock-compatible JSON Schema
 *   - ensureAdditionalPropertiesFalse() — post-processor for Bedrock compliance (D-22)
 *   - GenuiPromptPayload / ActionRules types
 */

export {
  ALLOWED_PROCEDURES,
  AllowedProcedureSchema,
} from "./allowed-procedures";
export type { AllowedProcedure } from "./allowed-procedures";

export {
  PACKAGE_ROOT,
  ARTIFACT_DIR,
  SPEC_SCHEMA_PATH,
  GENUI_PROMPT_PATH,
  buildSpecSchema,
  buildGenuiPromptPayload,
  ensureAdditionalPropertiesFalse,
} from "./artifact-builder";
export type { GenuiPromptPayload, ActionRules } from "./artifact-builder";
