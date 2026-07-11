/**
 * apps/web/e2e/helpers/uat-chat-fixtures.ts — DB fixture seeding for the
 * Phase-41 knowledge-preview canvas node UAT burn-down (Phase 50 Plan 02,
 * LIVE-05).
 *
 * Seeds a focus knowledge_node with BOTH a 1-hop EXTRACTED-tier neighbour,
 * a 1-hop INFERRED-tier neighbour, and a 2-hop AMBIGUOUS-tier neighbour
 * (reached via the EXTRACTED 1-hop node) — so `knowledge.expandNode`
 * (packages/api-client/src/router/knowledge/expand.ts) has real, tier-diverse
 * content to lay out (41.1's two-ring layout + tier styling is never
 * exercised vacuously). Mirrors the fixed-id `ON CONFLICT DO UPDATE`
 * idempotency discipline of live-loop-green.spec.ts / screenshot-fixtures.ts
 * — re-running the harness never grows a duplicate pile. Never logs secrets.
 */

import path from "node:path";

import { config as loadDotenv } from "dotenv";
import pg from "pg";

// Playwright's test runner does not load root .env.local itself — see
// seed-session.ts's identical note. npm workspaces run this with
// cwd = apps/web, so .env.local is two levels up.
loadDotenv({
  path: path.resolve(process.cwd(), "..", "..", ".env.local"),
  override: false,
});

// Fixed fixture ids — own namespace ("ee000000-41xx-...", distinct from
// live-loop-green.spec.ts / screenshot-fixtures.ts / uat-39-tool-round.spec.ts).
const FOCUS_NODE_ID = "ee000000-4100-4eee-8eee-000000000001";
const ONE_HOP_EXTRACTED_ID = "ee000000-4100-4eee-8eee-000000000002";
const ONE_HOP_INFERRED_ID = "ee000000-4100-4eee-8eee-000000000003";
const TWO_HOP_AMBIGUOUS_ID = "ee000000-4100-4eee-8eee-000000000004";
const EDGE_FOCUS_TO_EXTRACTED_ID = "ee000000-4100-4eee-8eee-0000000000e1";
const EDGE_FOCUS_TO_INFERRED_ID = "ee000000-4100-4eee-8eee-0000000000e2";
const EDGE_EXTRACTED_TO_AMBIGUOUS_ID = "ee000000-4100-4eee-8eee-0000000000e3";

/** Fixed id for the seeded `knowledge-preview` canvas node placed on a
 * fixture conversation's canvas layout — callers use this to locate the
 * node in the DOM (`.react-flow__node[data-id="..."]`). */
export const KNOWLEDGE_PREVIEW_NODE_ID = "knowledge-preview:uat41-fixture";

export interface SeedKnowledgeGraphFixtureResult {
  readonly importerId: string;
  readonly focusNodeId: string;
  readonly oneHopExtractedId: string;
  readonly oneHopInferredId: string;
  readonly twoHopAmbiguousId: string;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `uat-chat-fixtures: missing required environment variable "${name}". ` +
        "Ensure the local Supabase stack is running (scripts/preflight-local.ps1) " +
        "and root .env.local is populated per docs/RUN-LOCAL.md.",
    );
  }
  return value;
}

export async function resolveImporterId(client: pg.Client, userId: string): Promise<string> {
  const importerRow = await client.query<{ id: string }>(
    "SELECT id FROM importers WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1",
    [userId],
  );
  const importerId = importerRow.rows[0]?.id;
  if (importerId === undefined) {
    throw new Error(
      `uat-chat-fixtures: seeded user ${userId} owns no importer — run scripts/preflight-local.ps1 first`,
    );
  }
  return importerId;
}

async function upsertKnowledgeNode(
  client: pg.Client,
  params: { readonly id: string; readonly importerId: string; readonly title: string },
): Promise<void> {
  await client.query(
    `INSERT INTO knowledge_nodes (id, importer_id, title, content, scope, source, confidence, tier, is_active)
     VALUES ($1, $2, $3, $4, 'importer_global', 'manual', 1.0, 'EXTRACTED', true)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, is_active = true`,
    [params.id, params.importerId, params.title, `${params.title} — UAT-41 fixture content.`],
  );
}

async function upsertKnowledgeEdge(
  client: pg.Client,
  params: {
    readonly id: string;
    readonly sourceNodeId: string;
    readonly targetRefId: string;
    readonly tier: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  },
): Promise<void> {
  await client.query(
    `INSERT INTO knowledge_node_edges (id, source_node_id, target_ref_id, relation_type, confidence, source, tier, is_active)
     VALUES ($1, $2, $3, 'related', 1.0, 'manual', $4, true)
     ON CONFLICT (id) DO UPDATE SET tier = EXCLUDED.tier, is_active = true`,
    [params.id, params.sourceNodeId, params.targetRefId, params.tier],
  );
}

/**
 * seedKnowledgeGraphFixture — idempotently upserts a focus knowledge_node
 * with a 1-hop EXTRACTED-tier neighbour, a 1-hop INFERRED-tier neighbour,
 * and a 2-hop AMBIGUOUS-tier neighbour (reached via the EXTRACTED 1-hop
 * node) — so a placed `knowledge-preview` node's mini-graph has real,
 * tier-diverse content to render (41.1's two-ring layout + dashed/faint/
 * solid tier styling), never a vacuous single-node preview.
 */
export async function seedKnowledgeGraphFixture(
  client: pg.Client,
  userId: string,
): Promise<SeedKnowledgeGraphFixtureResult> {
  const importerId = await resolveImporterId(client, userId);

  await upsertKnowledgeNode(client, { id: FOCUS_NODE_ID, importerId, title: "UAT-41 Focus Node" });
  await upsertKnowledgeNode(client, {
    id: ONE_HOP_EXTRACTED_ID,
    importerId,
    title: "UAT-41 One-Hop Extracted Neighbour",
  });
  await upsertKnowledgeNode(client, {
    id: ONE_HOP_INFERRED_ID,
    importerId,
    title: "UAT-41 One-Hop Inferred Neighbour",
  });
  await upsertKnowledgeNode(client, {
    id: TWO_HOP_AMBIGUOUS_ID,
    importerId,
    title: "UAT-41 Two-Hop Ambiguous Neighbour",
  });

  await upsertKnowledgeEdge(client, {
    id: EDGE_FOCUS_TO_EXTRACTED_ID,
    sourceNodeId: FOCUS_NODE_ID,
    targetRefId: ONE_HOP_EXTRACTED_ID,
    tier: "EXTRACTED",
  });
  await upsertKnowledgeEdge(client, {
    id: EDGE_FOCUS_TO_INFERRED_ID,
    sourceNodeId: FOCUS_NODE_ID,
    targetRefId: ONE_HOP_INFERRED_ID,
    tier: "INFERRED",
  });
  await upsertKnowledgeEdge(client, {
    id: EDGE_EXTRACTED_TO_AMBIGUOUS_ID,
    sourceNodeId: ONE_HOP_EXTRACTED_ID,
    targetRefId: TWO_HOP_AMBIGUOUS_ID,
    tier: "AMBIGUOUS",
  });

  return {
    importerId,
    focusNodeId: FOCUS_NODE_ID,
    oneHopExtractedId: ONE_HOP_EXTRACTED_ID,
    oneHopInferredId: ONE_HOP_INFERRED_ID,
    twoHopAmbiguousId: TWO_HOP_AMBIGUOUS_ID,
  };
}
