/**
 * schema/action-schema.ts — Allowlist 3: Action discriminated union (D-14 / SAFE-04).
 *
 * ActionSchema is a discriminated union on "type" with three branches:
 *
 *   navigate  — relative-href-only navigation (SAFE-04 / D-14)
 *               href MUST start with "/" AND must not be an absolute or
 *               protocol-relative URL. Rejects: javascript:, data:, https://,
 *               http://, //, and any path not starting with /.
 *
 *   setState  — assigns a declared state slot (reuses Phase-12 declared-state model)
 *               key max 64 chars; value is a primitive union
 *
 *   mutate    — DEFINED but EMPTY seam (SEAM-02 / D-14)
 *               ALLOWED_MUTATIONS is [] as const — z.never() means the procedure
 *               field rejects every string. The branch is grammar-present and
 *               validates, but binds to no live mutation in v1.1.
 *               v1.2+ fills the seam by populating ALLOWED_MUTATIONS.
 *
 * Every object ends in .strict() (Bedrock additionalProperties:false, D-22).
 * No eval / dangerouslySetInnerHTML anywhere on this path (D-24).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// SEAM-02: Mutation allowlist — empty in v1.1 (D-14 / D-23)
//
// ALLOWED_MUTATIONS intentionally starts as an empty tuple.
// z.enum() requires at least one element, so when the array is empty we
// fall back to z.never() which rejects every value — preserving the invariant
// that NO live mutation can be named while the branch validates the surrounding
// object shape.
//
// Phase v1.2+: populate ALLOWED_MUTATIONS to wire the first live mutation.
// Each addition requires the allowlist-change review gate (GR-20 / D-23).
// ---------------------------------------------------------------------------

/** Hand-curated mutation allowlist. Empty in v1.1 — SEAM-02. */
export const ALLOWED_MUTATIONS = [] as const;

/** Inferred type (never, because the array is empty). */
type AllowedMutation = (typeof ALLOWED_MUTATIONS)[number];

/**
 * AllowedMutationSchema — z.never() when ALLOWED_MUTATIONS is empty.
 *
 * This means the mutate branch validates the outer object shape but the
 * `procedure` field rejects every string value (SEAM-02 / D-14). The branch
 * is grammar-present (compiles, emits in JSON Schema) but binds nothing.
 *
 * Implementation note: z.enum([]) would throw at construction time because
 * Zod enums require at least one element. We use z.never() instead, which
 * correctly expresses "no value is valid here" at runtime and compiles cleanly.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const AllowedMutationSchema: z.ZodType<AllowedMutation> = z.never();

// ---------------------------------------------------------------------------
// navigate — relative-href-only (SAFE-04 / D-14 / T-13-03)
//
// Security controls:
//   1. z.string().startsWith("/") — href must begin with /
//   2. .refine(noAbsoluteScheme) — rejects javascript:, data:, https://,
//      http://, // (protocol-relative), and any other scheme (regex: ^[a-z]+:)
//
// Both checks are needed: startsWith("/") alone would pass "//evil.com"
// (starts with /) which is protocol-relative and allows cross-origin.
// The refine rejects that by matching /^\/\//. Similarly javascript:
// does not start with "/" so check 1 already rejects it, but the refine
// adds defense-in-depth and documents intent clearly.
// ---------------------------------------------------------------------------

/** Regex: matches absolute scheme (letter+ colon) or protocol-relative (//) */
const ABSOLUTE_OR_SCHEME_PATTERN = /^([a-z][a-z0-9+\-.]*:|\/\/)/i;

/**
 * Returns true if the href is a safe relative path (no absolute scheme or //).
 * A safe href starts with / and is NOT protocol-relative or scheme-prefixed.
 */
function noAbsoluteScheme(href: string): boolean {
  return !ABSOLUTE_OR_SCHEME_PATTERN.test(href);
}

const NavigateActionSchema = z
  .object({
    type: z.literal("navigate"),
    href: z
      .string()
      .startsWith("/", { message: "navigate href must start with / (relative paths only)" })
      .refine(noAbsoluteScheme, {
        message:
          "navigate href must not use an absolute scheme (javascript:, data:, https:, http:) " +
          "or protocol-relative URL (//) — only relative paths starting with / are allowed (SAFE-04 / D-14)",
      }),
  })
  .strict();

// ---------------------------------------------------------------------------
// setState — declares a state slot assignment (Phase-12 state model)
// ---------------------------------------------------------------------------

const SetStateActionSchema = z
  .object({
    type: z.literal("setState"),
    key: z
      .string()
      .min(1)
      .max(64, { message: "setState key must not exceed 64 characters" }),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })
  .strict();

// ---------------------------------------------------------------------------
// mutate — grammar-present, empty-seam branch (SEAM-02 / D-14)
// ---------------------------------------------------------------------------

const MutateActionSchema = z
  .object({
    type: z.literal("mutate"),
    /** procedure: z.never() — ALLOWED_MUTATIONS is empty; no mutation is reachable (SEAM-02). */
    procedure: AllowedMutationSchema,
    params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  })
  .strict();

// ---------------------------------------------------------------------------
// ActionSchema — discriminated union
// ---------------------------------------------------------------------------

/**
 * ActionSchema — the action discriminated union for Phase 13 (D-14 / SAFE-04).
 *
 * Discriminator: "type" field (navigate | setState | mutate).
 *
 * All three branches are defined and validate their shape, but:
 *   - navigate: relative-href-only (rejects schemes/external URLs)
 *   - setState: key + primitive value
 *   - mutate: procedure is z.never() — the seam is empty in v1.1 (SEAM-02)
 *
 * Attached to ButtonNodeSchema via onClick field in spec-schema.ts (D-14 / D-23).
 * Never overloads the Phase-12 string `action` field — uses a new `onClick` field
 * to avoid breaking existing renderer code that consumes `action` as an ActionRegistry key.
 */
export const ActionSchema = z.discriminatedUnion("type", [
  NavigateActionSchema,
  SetStateActionSchema,
  MutateActionSchema,
]);

export type Action = z.infer<typeof ActionSchema>;
export type NavigateAction = z.infer<typeof NavigateActionSchema>;
export type SetStateAction = z.infer<typeof SetStateActionSchema>;
export type MutateAction = z.infer<typeof MutateActionSchema>;
