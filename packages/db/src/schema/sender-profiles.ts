/**
 * Phase 4 — Email Intelligence: sender_profiles table (RESEARCH §3.10).
 *
 * Tracks metadata about email senders — classification, noise flag, and
 * optional link to a known entity_instance. Used by retrieval to filter
 * knowledge nodes by scope='sender' and to detect noise senders early.
 */

import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { EntityInstances } from "./entity-instances";
import { Importers } from "./importers";

// ---------------------------------------------------------------------------
// sender_profiles
// ---------------------------------------------------------------------------
export const SenderProfiles = pgTable(
  "sender_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    importerId: uuid("importer_id")
      .notNull()
      .references(() => Importers.id, { onDelete: "cascade" }),

    emailAddress: text("email_address").notNull(),
    displayName: text("display_name"),

    // 'supplier' | 'freight_forwarder' | 'customs_broker' | 'maritime_line' | 'internal'
    category: text("category"),

    // true = never create records from emails by this sender
    isNoise: boolean("is_noise").notNull().default(false),

    notes: text("notes"),

    // When the sender is linked to a known entity in the Nauta mirror
    linkedEntityInstanceId: uuid("linked_entity_instance_id").references(
      () => EntityInstances.id,
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    senderProfileUniquePerImporter: unique(
      "sender_profiles_importer_email_unique",
    ).on(t.importerId, t.emailAddress),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type SenderProfileRow = typeof SenderProfiles.$inferSelect;
export type InsertSenderProfile = typeof SenderProfiles.$inferInsert;
