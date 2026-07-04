/**
 * node-registry-version.ts — deterministic, browser-safe content-hash for
 * NODE_TYPE_REGISTRY (FOUND-2, D-04).
 *
 * Mirrors packages/genui/src/registry/registry-version.ts's content-hash
 * PATTERN (sort keys, serialize a stable public surface per entry, hash the
 * concatenation) but must stay browser-safe: this module is imported by
 * client components (GenuiPanelNode, the canvas surface), where Node's
 * `crypto.createHash` is unavailable. It hashes a stable string with a small
 * pure FNV-1a hash instead of SHA-256.
 *
 * A Zod schema instance isn't directly JSON-serializable (its internal def
 * mixes plain data with functions/lazy shape getters), so `summarizeSchemaShape`
 * walks ONLY the documented, stable Zod v3 public surface — `.shape`,
 * `.innerType()`, `.unwrap()`, `_def.typeName`, `_def.checks[].kind`,
 * `_def.unknownKeys` — to build a plain, JSON-serializable structural summary.
 * The property that matters (D-04): adding/removing/renaming a field,
 * changing a field's type, changing nullability/optionality, or changing a
 * Zod check (e.g. `.min()`, `.uuid()`) all flip the hash. Bounded recursion
 * depth guards against a runaway walk on a pathologically nested schema.
 */

import { z } from "zod";

import type { NodeTypeRegistryEntry } from "./node-type-registry";
import { NODE_TYPE_REGISTRY } from "./node-type-registry";

const MAX_SHAPE_DEPTH = 6;

/** Unwraps ZodEffects (the `.refine()` wrapper) down to the underlying schema. */
function unwrapEffects(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current: z.ZodTypeAny = schema;
  while (current instanceof z.ZodEffects) {
    current = current.innerType();
  }
  return current;
}

/** A plain, JSON-serializable structural summary of a Zod schema's public shape. */
function summarizeSchemaShape(schema: z.ZodTypeAny, depth: number = MAX_SHAPE_DEPTH): unknown {
  if (depth <= 0) return { truncated: true };

  const unwrapped = unwrapEffects(schema);
  const typeName = (unwrapped._def as { typeName?: string }).typeName ?? "unknown";

  if (unwrapped instanceof z.ZodObject) {
    const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
    const fieldNames = Object.keys(shape).sort();
    return {
      typeName,
      unknownKeys: (unwrapped._def as { unknownKeys?: string }).unknownKeys ?? null,
      fields: fieldNames.map((name) => ({
        name,
        shape: summarizeSchemaShape(shape[name]!, depth - 1),
      })),
    };
  }
  if (unwrapped instanceof z.ZodNullable || unwrapped instanceof z.ZodOptional) {
    return { typeName, inner: summarizeSchemaShape(unwrapped.unwrap(), depth - 1) };
  }

  const checks = (unwrapped._def as { checks?: Array<{ kind: string }> }).checks;
  return {
    typeName,
    checks: Array.isArray(checks) ? checks.map((c) => c.kind).sort() : [],
  };
}

function serializeEntry(entry: NodeTypeRegistryEntry): string {
  return JSON.stringify({
    id: entry.id,
    description: entry.description,
    schemaShape: summarizeSchemaShape(entry.dataSchema),
  });
}

/**
 * Pure FNV-1a 32-bit hash over a string (charCode-based — no Buffer, no Node
 * `crypto`). Deterministic for a given input string; 8-hex-char output.
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * computeNodeRegistryHash — deterministic hex digest over the registry's
 * public surface (sorted entry ids + each entry's description + a structural
 * schema-shape summary). Sorting keys makes registration ORDER irrelevant;
 * ANY entry addition/removal/rename, description edit, or schema-shape change
 * flips the hash.
 */
export function computeNodeRegistryHash(
  registry: Record<string, NodeTypeRegistryEntry>,
): string {
  const sortedKeys = Object.keys(registry).sort();
  const serialized = sortedKeys
    .map((key) => serializeEntry(registry[key]!))
    .join("\n");
  return fnv1aHex(serialized);
}

/** The content-hash version identifier for the current NODE_TYPE_REGISTRY. */
export const NODE_REGISTRY_VERSION: string = computeNodeRegistryHash(NODE_TYPE_REGISTRY);
