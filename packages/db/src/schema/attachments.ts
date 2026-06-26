/**
 * Phase 4 — Email Intelligence: email_attachments table.
 *
 * One row per file attached to an email. Raw bytes stored in Supabase Storage;
 * this table stores metadata and pipeline state only.
 */

import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { Emails } from "./emails";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// email_attachments — metadata for each file attached to an email
// ---------------------------------------------------------------------------
export const EmailAttachments = pgTable(
  "email_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    emailId: uuid("email_id")
      .notNull()
      .references(() => Emails.id, { onDelete: "cascade" }),

    // -- File metadata --
    filename: text("filename").notNull(),
    // IANA content type, e.g. "application/pdf"
    contentType: text("content_type").notNull(),
    // File extension without dot, e.g. "pdf"
    fileExt: text("file_ext"),
    // Size in bytes (bigint to handle files > 2 GB)
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    // Storage key in Supabase Storage / S3
    storageKey: text("storage_key"),
    // For attachments extracted from a parent (e.g. pages from a PDF)
    parentAttachmentId: uuid("parent_attachment_id"),

    // -- Multi-page docs: total page / sheet count after parsing --
    pageCount: integer("page_count"),
    sheetCount: integer("sheet_count"),

    // -- Pipeline state --
    parseStatus: text("parse_status").notNull().default("pending"),
    parseError: text("parse_error"),
    parsedAt: timestamp("parsed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailAttachmentsEmailIdx: index("idx_email_attachments_email_id").on(
      t.emailId,
    ),
    emailAttachmentsImporterIdx: index(
      "idx_email_attachments_importer_id",
    ).on(t.importerId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type EmailAttachmentRow = typeof EmailAttachments.$inferSelect;
export type InsertEmailAttachment = typeof EmailAttachments.$inferInsert;
