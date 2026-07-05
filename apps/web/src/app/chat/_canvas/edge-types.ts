/**
 * edge-types.ts — the module-level React Flow `edgeTypes` map (mirrors
 * `node-types.ts`'s own D-04/D-07 rationale: defined ONCE at module scope,
 * never inline in render, so a fresh object identity on every render never
 * forces React Flow to remount every edge).
 */

import type { EdgeTypes } from "@xyflow/react";

import { DataEdge } from "./data-edge";

export const edgeTypes: EdgeTypes = {
  "data-edge": DataEdge,
};
