/**
 * Phase 70 — Documents (DOCS-02/DOCS-03): the `documents` table.
 *
 * Wave 1 shipped the typeset-PDF PIPELINE (the print route + api/documents/[id]/
 * pdf + report-document.ts's in-module `ReportDocument` registry). This table is
 * the first-class document STORE that swaps that in-module registry for real,
 * owner-scoped, re-openable rows (report-document.ts's own documented seam:
 * "DOCS-02 replaces the in-module registry with an owner-scoped DB read").
 *
 * ## A document is stored, listed, re-openable, and REGENERABLE (DOCS-03)
 *
 *   - `spec` (jsonb) is the structured `ReportDocument` (title/subtitle/blocks/
 *     provenance marks — the shape apps/web/.../_lib/report-document.ts defines).
 *     It is the regenerate-from-spec input (Phase 70 acceptance 3 / INV-7): the
 *     print route and the PDF handler typeset FROM this spec, so the on-screen
 *     HTML, the exported PDF, and any regeneration reproduce identical
 *     provenance with zero divergence. Stored as jsonb (not a text blob) so the
 *     model is queryable/inspectable, mirroring the genui_generation_events /
 *     chat message-part idiom for structured payloads.
 *
 *   - `sourceLedgerId` (nullable FK -> chat_source_ledger, ON DELETE SET NULL)
 *     is the PROVENANCE anchor (INV-7): when a document is synthesised from a
 *     research run it points at the RCNV-01 source-ledger row it was assembled
 *     from. Nullable because a document can be authored without a ledger origin;
 *     SET NULL (not CASCADE/RESTRICT) so deleting a ledger row never orphans or
 *     blocks-delete a document that already exists on its own (mirrors
 *     chat_source_ledger.knowledgeNodeId's own survive-deletion posture).
 *
 * ## Tenancy (INV-8/INV-9)
 *
 * documents is NOT an importer-descendant — like chat_conversations and
 * forwarding_addresses it carries a DIRECT `user_id` referencing auth.users(id),
 * scoped directly (no join). Ownership resolves through the central helper
 * `assertDocumentOwnership` (ownership.ts) — never an ad-hoc per-call-site
 * user_id filter. The owner-scoping RLS policies (RESTRICTIVE deny-anon +
 * PERMISSIVE owner-authenticated) ship in the SAME migration as the table
 * (INV-8/9), mirroring forwarding_addresses in 0035_threads_forwarding.sql.
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { AuthUsers } from "./_auth";
import { ChatSourceLedger } from "./chat-source-ledger";

// ---------------------------------------------------------------------------
// documents — first-class, owner-scoped, regenerable documents (DOCS-02/03)
// ---------------------------------------------------------------------------
export const Documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Direct ownership anchor (INV-8/9) — mirrors chat_conversations /
    // forwarding_addresses. No importer join; scoped directly by user_id.
    userId: uuid("user_id")
      .notNull()
      .references(() => AuthUsers.id, { onDelete: "cascade" }),

    title: text("title").notNull().default("Untitled document"),

    // DOCS-03 / INV-7: the structured `ReportDocument` the print route + PDF
    // handler typeset from — the regenerate-from-spec input. jsonb so it stays
    // queryable/inspectable rather than an opaque blob.
    spec: jsonb("spec").notNull(),

    // INV-7 provenance: the RCNV-01 source-ledger row this document was
    // synthesised from, when it has a research origin. SET NULL so deleting the
    // ledger row never orphans or blocks-delete the document.
    sourceLedgerId: uuid("source_ledger_id").references(
      () => ChatSourceLedger.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Ownership lookups + the documents list (per-user, newest first).
    documentsUserIdIdx: index("idx_documents_user_id").on(t.userId),
    // Provenance joins / "documents from this research run" lookups.
    documentsSourceLedgerIdIdx: index("idx_documents_source_ledger_id").on(
      t.sourceLedgerId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type DocumentRow = typeof Documents.$inferSelect;
export type InsertDocument = typeof Documents.$inferInsert;
