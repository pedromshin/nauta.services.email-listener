/**
 * Phase 4 — Email Intelligence: email_components table (D-12, D-09).
 *
 * A "component" is the smallest extractable unit from an email or attachment:
 * a table, a text block, an image, a section. The embedding column enables
 * semantic retrieval (halfvec saves ~50% memory vs float4 vector).
 *
 * Self-referential parentComponentId supports nested structures such as
 * a table cell inside a table inside a document section.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { halfvec } from "./_halfvec";
import {
  componentRoleEnum,
  componentSourceTypeEnum,
  extractionStatusEnum,
} from "./enums";
import { Emails } from "./emails";
import { EmailAttachments } from "./attachments";
import { EntityTypes, EntityTypeFields } from "./entity-types";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// email_components — extracted semantic units from emails and attachments
// ---------------------------------------------------------------------------
export const EmailComponents = pgTable(
  "email_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    emailId: uuid("email_id")
      .notNull()
      .references(() => Emails.id, { onDelete: "cascade" }),

    attachmentId: uuid("attachment_id").references(
      () => EmailAttachments.id,
      { onDelete: "cascade" },
    ),

    // -- Hierarchy --
    // Self-referential: table cell → table → page section → document
    parentComponentId: uuid("parent_component_id"),
    // Zero-based position among siblings sharing the same parent
    sequenceIndex: integer("sequence_index").notNull().default(0),

    // -- Provenance --
    sourceType: componentSourceTypeEnum("source_type").notNull(),

    /**
     * Spatial / positional location within the source document.
     * Shape:
     *   {
     *     page_index?: number,            // 0-based PDF page
     *     sheet_index?: number,           // 0-based spreadsheet sheet
     *     polygon?: [[x,y], ...],        // normalized [0,1] coordinates
     *     text_anchor?: { char_start: number; char_end: number }
     *   }
     */
    location: jsonb("location"),

    // -- Content (at most one of these will be non-null per component) --
    contentText: text("content_text"),
    contentMarkdown: text("content_markdown"),
    contentRaw: jsonb("content_raw"),

    // -- Semantic embedding --
    // halfvec(1536) matches OpenAI text-embedding-3-* output dimensions
    embedding: halfvec("embedding", { dimensions: 1536 }),

    // -- Extraction lifecycle --
    extractionStatus: extractionStatusEnum("extraction_status")
      .notNull()
      .default("candidate"),

    // -- Phase 9 relationship model (D-01..D-04) --
    // role: the region's relationship role. NULL = unclassified/standalone
    // (a freshly drawn box not yet assigned). No .notNull() per D-01/D-02.
    role: componentRoleEnum("role"),
    // entityTypeId (D-03): an ENTITY region records its entity type here.
    // Declared FK for referential integrity; onDelete "set null" so deleting a
    // referenced entity type nulls the link rather than cascade-deleting the
    // component (hard deletes are guarded in 09-03 per D-27).
    entityTypeId: uuid("entity_type_id").references(() => EntityTypes.id, {
      onDelete: "set null",
    }),
    // entityTypeFieldId (D-04): a FIELD region records WHICH property it maps
    // to here. Same set-null rationale as entityTypeId.
    entityTypeFieldId: uuid("entity_type_field_id").references(
      () => EntityTypeFields.id,
      { onDelete: "set null" },
    ),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    componentEmailIdx: index("idx_email_components_email_id").on(t.emailId),
    componentAttachmentIdx: index("idx_email_components_attachment_id").on(
      t.attachmentId,
    ),
    componentImporterIdx: index("idx_email_components_importer_id").on(
      t.importerId,
    ),
    componentParentIdx: index("idx_email_components_parent_id").on(
      t.parentComponentId,
    ),
    componentStatusIdx: index("idx_email_components_extraction_status").on(
      t.extractionStatus,
    ),
    // Phase 9 (D-01/D-03): role is the core queryable axis of this phase and
    // entity_type_id is a frequent filter/join target — both indexed.
    componentRoleIdx: index("idx_email_components_role").on(t.role),
    componentEntityTypeIdx: index("idx_email_components_entity_type_id").on(
      t.entityTypeId,
    ),
    // HNSW ANN index for embedding similarity search is added via custom SQL
    // migration (drizzle-kit cannot emit halfvec_cosine_ops operator class).
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type EmailComponentRow = typeof EmailComponents.$inferSelect;
export type InsertEmailComponent = typeof EmailComponents.$inferInsert;
