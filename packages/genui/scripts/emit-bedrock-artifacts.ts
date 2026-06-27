/**
 * scripts/emit-bedrock-artifacts.ts — Emit Bedrock-compatible artifacts from the Zod source.
 *
 * Run via: pnpm gen:artifacts   (tsx scripts/emit-bedrock-artifacts.ts)
 *
 * Produces two committed artifacts under packages/genui/artifacts/:
 *
 *   spec.schema.json    — JSON Schema of SpecRootSchema.
 *                         Consumed by the Python generator as Bedrock's tool input_schema.
 *                         Enforces component-type enum + ALLOWED_PROCEDURES enum so Bedrock
 *                         constrained decoding cannot emit unregistered types (D-12/D-13).
 *
 *   genui-prompt.json   — Compact catalog + ALLOWED_PROCEDURES + REGISTRY_VERSION + action rules.
 *                         Consumed by the Python generator to build the system prompt.
 *
 * Both files are deterministic: running twice on the same code produces byte-identical output.
 * A CI freshness test (src/generation/__tests__/artifacts.test.ts) verifies committed files
 * match freshly generated payloads — any Zod schema change that drifts the committed artifacts
 * causes CI to fail (D-03 / T-13-06).
 *
 * Bedrock compatibility (CURRENCY-2026 §2):
 *   - additionalProperties:false on every schema object
 *   - No external $ref ($refStrategy:"none" inlines all sub-schemas)
 *   - Stable component-type and procedure enums for 24h grammar cache
 */

import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_DIR,
  SPEC_SCHEMA_PATH,
  GENUI_PROMPT_PATH,
  buildSpecSchema,
  buildGenuiPromptPayload,
} from "../src/generation/artifact-builder.js";

// ---------------------------------------------------------------------------
// Emit spec.schema.json
// ---------------------------------------------------------------------------

const specSchema = buildSpecSchema();
const specSchemaJson = JSON.stringify(specSchema, null, 2);

// Ensure artifacts directory exists
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

fs.writeFileSync(SPEC_SCHEMA_PATH, specSchemaJson + "\n", "utf8");
console.log(`[emit-bedrock-artifacts] wrote ${path.relative(process.cwd(), SPEC_SCHEMA_PATH)}`);

// ---------------------------------------------------------------------------
// Emit genui-prompt.json
// ---------------------------------------------------------------------------

const promptPayload = buildGenuiPromptPayload();
const promptJson = JSON.stringify(promptPayload, null, 2);

fs.writeFileSync(GENUI_PROMPT_PATH, promptJson + "\n", "utf8");
console.log(`[emit-bedrock-artifacts] wrote ${path.relative(process.cwd(), GENUI_PROMPT_PATH)}`);

console.log("[emit-bedrock-artifacts] done.");
