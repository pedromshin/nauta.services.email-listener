/**
 * schema/token-props-schema.ts — Fourth TOKEN allowlist at the Zod spec boundary (D-06/STYLE-03).
 *
 * This module provides:
 *   - TokenAliasSchema: z.enum derived from TOKEN_ALIASES (the authoritative closed set)
 *   - StylePackIdSchema: z.enum derived from StylePackId string-literal union
 *   - TokenPropsSchema: strict optional-value map — only known aliases allowed as keys,
 *     string values only (no raw hex validation here — that is enforced in the pack registry)
 *
 * ENFORCEMENT STRATEGY (D-06/STYLE-03):
 *   - Bedrock outputs a `style_pack_id` (validated by StylePackIdSchema) in the spec envelope.
 *   - Bedrock may optionally output per-node `style` overrides with TokenPropsSchema values.
 *   - Raw hex (#xxxxx), calc(), url(), and var() are rejected because they are NOT valid
 *     TOKEN_ALIAS strings. The alias allowlist is the gate — the value for each alias is
 *     trusted to come from the pack registry (packs.ts), not from the LLM output.
 *
 * IMPORTANT: TokenPropsSchema is for per-node style OVERRIDE hints that reference aliases.
 * The actual resolved values always come from the pack registry — never from LLM output.
 *
 * Integration points:
 *   - spec-schema.ts: StylePackIdSchema added to SpecRootSchema as optional `style_pack_id`
 *   - allowlists.ts: re-exports TokenAliasSchema, TokenPropsSchema, STYLE_PACK_IDS
 *   - schema/index.ts: re-exports new symbols
 */

import { z } from "zod";

import { TOKEN_ALIASES } from "../theme/tokens";
import { STYLE_PACK_IDS } from "../theme/packs";

// ===========================================================================
// TokenAliasSchema — Allowlist 4 (D-06)
//
// Derived directly from TOKEN_ALIASES tuple via z.enum().
// z.enum() requires a [string, ...string[]] tuple (non-empty), hence the cast.
// TOKEN_ALIASES is guaranteed non-empty at compile time by its const literal type.
// ===========================================================================

/**
 * Zod schema for a single token alias.
 * Only values present in TOKEN_ALIASES are accepted.
 *
 * Rejected inputs include:
 *   - Raw hex colors ("#ff0000", "#fff")
 *   - CSS functions ("calc(...)", "url(...)", "var(--x)", "hsl(...)")
 *   - Unknown alias strings ("color.unknown", "anything", etc.)
 *   - Empty string ("")
 */
export const TokenAliasSchema: z.ZodEnum<[string, ...string[]]> = z.enum(
  TOKEN_ALIASES as unknown as [string, ...string[]],
);

export type TokenAlias = z.infer<typeof TokenAliasSchema>;

/** The full set of valid token alias strings (re-exported for convenience). */
export const TOKEN_ALIAS_VALUES: ReadonlyArray<string> = TOKEN_ALIASES;

// ===========================================================================
// StylePackIdSchema — Allowlist for style_pack_id in SpecRootSchema (D-08/STYLE-04)
// ===========================================================================

/**
 * Zod schema for a style pack id.
 * Only values present in STYLE_PACK_IDS are accepted.
 *
 * STYLE_PACK_IDS is derived from STYLE_PACKS keys at module load, so
 * it auto-updates when new packs are added.
 */
export const StylePackIdSchema: z.ZodEnum<[string, ...string[]]> = z.enum(
  STYLE_PACK_IDS as unknown as [string, ...string[]],
);

export type StylePackId = z.infer<typeof StylePackIdSchema>;

// ===========================================================================
// TokenPropsSchema — strict per-node style override map (D-06)
//
// Each key must be a valid TokenAlias. Each value is a plain string.
// Additional properties are NOT allowed (strict Zod shape).
//
// The schema is built as a z.object with every TOKEN_ALIAS as an optional
// string field. This provides:
//   1. Key-level allowlist enforcement (unknown keys are rejected by .strict())
//   2. All overrides are optional (no pack is required to override every alias)
//   3. Bedrock-compatible: strict objects, no free-form Record<string, string>
// ===========================================================================

/**
 * Builds the TokenPropsSchema as a strict z.object with optional string fields
 * for every alias in TOKEN_ALIASES.
 *
 * We build this programmatically so it stays in sync with TOKEN_ALIASES automatically.
 * The resulting schema is equivalent to:
 *   z.object({
 *     "color.background": z.string().optional(),
 *     "color.foreground": z.string().optional(),
 *     ... (one entry per alias)
 *   }).strict()
 */
function buildTokenPropsSchema(): z.ZodObject<
  Record<string, z.ZodOptional<z.ZodString>>,
  "strict"
> {
  const shape: Record<string, z.ZodOptional<z.ZodString>> = {};
  for (const alias of TOKEN_ALIASES) {
    shape[alias] = z.string().optional();
  }
  return z.object(shape).strict();
}

/**
 * TokenPropsSchema — validated per-node style override map.
 *
 * Only known token aliases are accepted as keys.
 * Values are plain strings (the LLM outputs alias names, not raw CSS values).
 * Additional fields beyond TOKEN_ALIASES are rejected by .strict().
 */
export const TokenPropsSchema = buildTokenPropsSchema();

export type TokenProps = z.infer<typeof TokenPropsSchema>;
