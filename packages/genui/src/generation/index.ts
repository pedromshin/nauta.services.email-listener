/**
 * generation/index.ts — Barrel for @nauta/genui generation module.
 *
 * Exports:
 *   - ALLOWED_PROCEDURES (procedure allowlist re-export for Python artifact)
 *   - AllowedProcedureSchema
 *   - ARTIFACT_DIR / SPEC_SCHEMA_PATH / GENUI_PROMPT_PATH — path constants (Task 2)
 *   - buildGenuiPromptPayload() — pure function shared by emit script + freshness test (Task 2)
 *
 * Phase 13 Task 2 adds artifact-builder exports below.
 */

export {
  ALLOWED_PROCEDURES,
  AllowedProcedureSchema,
} from "./allowed-procedures";
export type { AllowedProcedure } from "./allowed-procedures";
