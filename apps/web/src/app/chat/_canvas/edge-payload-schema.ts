/**
 * edge-payload-schema.ts — EdgePayloadSchema: the Zod boundary a
 * data-carrying edge's `{ sourcePath, targetKey }` payload must cross
 * BEFORE an edge is created or updated (STATE-02, FOUND-6, T-23-11).
 *
 * Mirrors `packages/api-client/src/router/chat/canvas-schema.ts`'s
 * `edgeDataSchema` verbatim — the SAME shape, the SAME FORBIDDEN_KEYS
 * dotted-path-segment guard (mirrors
 * `packages/genui/src/renderer/render-node.tsx`'s prototype-pollution
 * guard) — so a value validated here is guaranteed to also validate against
 * 23-01's `CanvasSnapshotSchema` at persist time (no drift between the
 * connect-time gate and the save-time gate).
 */

import { z } from "zod";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function hasForbiddenPathSegment(path: string): boolean {
  return path.split(".").some((segment) => FORBIDDEN_KEYS.has(segment));
}

export const EdgePayloadSchema = z
  .object({
    sourcePath: z
      .string()
      .min(1)
      .refine((value) => !hasForbiddenPathSegment(value), {
        message:
          "sourcePath must not contain a __proto__/constructor/prototype path segment",
      }),
    targetKey: z
      .string()
      .min(1)
      .refine((value) => !hasForbiddenPathSegment(value), {
        message:
          "targetKey must not contain a __proto__/constructor/prototype path segment",
      }),
  })
  .strict();

export type EdgePayload = z.infer<typeof EdgePayloadSchema>;
