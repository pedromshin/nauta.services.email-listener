/**
 * apps/web/src/app/documents/_lib/document-store.ts
 *
 * DOCS-02 — the owner-scoped, DB-backed document STORE that fulfils the seam
 * report-document.ts documents ("DOCS-02 replaces the in-module registry with
 * an owner-scoped DB read; every caller keeps calling exactly this signature").
 *
 * This module is SERVER-ONLY: it imports the Drizzle client + the central
 * ownership helper, so it must never be pulled into a client bundle. That is
 * exactly why it lives HERE and not in report-document.ts — report-document.ts
 * stays a pure, DB-free domain model (types + sample) that client components
 * (e.g. the detail page) can import freely, while this file is imported only by
 * the print server component and the PDF route handler.
 *
 * ## The stored `spec` is a ReportDocument (DOCS-03 / INV-7)
 *
 * A `documents` row's `spec` jsonb IS a {@link ReportDocument} — the same shape
 * the print route + PDF handler typeset. Regenerate-from-spec (INV-7) is
 * therefore just "read the row, validate the spec, typeset it": there is no
 * second representation to drift from. The spec is validated at this boundary
 * ({@link reportDocumentSpecSchema}) so a malformed stored row fails closed
 * (treated as not-found) rather than crashing the renderer with a partial shape.
 *
 * ## Ownership (INV-8/INV-9)
 *
 * {@link loadStoredDocument} takes the SERVER-VERIFIED userId (from
 * supabase.auth.getUser(), never a client field) and gates through the central
 * `assertDocumentOwnership` (@polytoken/db/ownership). A missing document and
 * one owned by another user both resolve to `null` — fail-closed, no existence
 * oracle, matching loadReportDocument's own contract.
 */

// NOTE: server-only by construction — this module imports the Drizzle client
// (@polytoken/db/client), which can never be bundled into a client component.
// Import it only from server components / route handlers (the print page + the
// PDF route), never from a "use client" module.

import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@polytoken/db/client";
import { Documents } from "@polytoken/db/schema";
import {
  assertDocumentOwnership,
  OwnershipError,
} from "@polytoken/db/ownership";

import type {
  Inline,
  ReportBlock,
  ReportDocument,
} from "./report-document";

// ---------------------------------------------------------------------------
// Spec validation — a Zod mirror of the ReportDocument model (report-document.ts)
//
// Kept structurally identical to the TS interfaces there. This is the write/
// read boundary contract: a stored `spec` that does not satisfy this shape is
// rejected, so the typeset renderer only ever sees a well-formed document.
// ---------------------------------------------------------------------------

const provSpanSchema = z.object({
  text: z.string(),
  tier: z.enum(["confirmed", "suggested"]),
  source: z.string().optional(),
});

const inlineSchema: z.ZodType<Inline> = z.union([z.string(), provSpanSchema]);

const headingBlockSchema = z.object({
  kind: z.literal("heading"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
});

const paragraphBlockSchema = z.object({
  kind: z.literal("paragraph"),
  runs: z.array(inlineSchema),
});

const evidenceBlockSchema = z.object({
  kind: z.literal("evidence"),
  runs: z.array(inlineSchema),
  cite: z.string().optional(),
});

const listBlockSchema = z.object({
  kind: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(z.array(inlineSchema)),
});

const reportBlockSchema: z.ZodType<ReportBlock> = z.discriminatedUnion("kind", [
  headingBlockSchema,
  paragraphBlockSchema,
  evidenceBlockSchema,
  listBlockSchema,
]);

/**
 * reportDocumentSpecSchema — validates a stored `documents.spec` jsonb as a
 * ReportDocument. `id`/`generatedAt` on the model are supplied from the row
 * (id, created_at) at load time, so a spec may omit them; everything else must
 * be present and well-typed.
 */
export const reportDocumentSpecSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  generatedAt: z.string().optional(),
  source: z.string().optional(),
  blocks: z.array(reportBlockSchema),
});

/**
 * loadStoredDocument — read an owner's document by id and return it as a
 * ReportDocument ready to typeset. Returns `null` for an unknown id, a document
 * owned by someone else, OR a stored spec that fails validation (fail-closed).
 *
 * `userId` MUST be the server-verified session user (supabase.auth.getUser()),
 * never a client-supplied value — the ownership gate is only as trustworthy as
 * the identity it is handed.
 */
export async function loadStoredDocument(
  id: string,
  userId: string,
): Promise<ReportDocument | null> {
  try {
    await assertDocumentOwnership(db, id, userId);
  } catch (error) {
    if (error instanceof OwnershipError) return null;
    throw error;
  }

  const rows = await db
    .select({
      id: Documents.id,
      title: Documents.title,
      spec: Documents.spec,
      createdAt: Documents.createdAt,
    })
    .from(Documents)
    .where(eq(Documents.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const parsed = reportDocumentSpecSchema.safeParse(row.spec);
  if (!parsed.success) {
    console.error(
      `[documents] stored spec for ${id} failed validation`,
      parsed.error.flatten(),
    );
    return null;
  }

  const spec = parsed.data;
  return {
    id: row.id,
    // The row's title is the source of truth for the heading/tab; the spec's
    // own title (if any) is a fallback only.
    title: row.title ?? spec.title ?? "Untitled document",
    subtitle: spec.subtitle,
    generatedAt: spec.generatedAt ?? row.createdAt.toISOString(),
    source: spec.source,
    blocks: spec.blocks,
  };
}
