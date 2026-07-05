/**
 * Phase 24 — Dual-Channel GenUI: chat_widget_interactions table (DCUI-04, D-01,
 * D-10, D-11, D-12).
 *
 * The persistence + safety-primitive spine for agent<->user widget round-trips.
 * One row per emitted interactive widget (`interactive_widget` message part —
 * D-04, one per turn). The row is the AUTHORITATIVE mutable lifecycle state +
 * declared response schema + submitted value; the `chat_messages.parts` jsonb
 * entry stays immutable-as-emitted (D-13/D-18) and only carries the interactionId.
 *
 * - `declaration` (jsonb): the full widget declaration incl. the proposal
 *   option id->value map, persisted server-side so the server (never the
 *   client) resolves the chosen payload on submit.
 * - `declaredResponseSchema` (jsonb): the STORED JSON Schema the submitted
 *   result is re-validated against (D-01/D-10) — never a client-supplied
 *   schema.
 * - `state`: pending -> submitted | superseded | stale (D-02/D-11/D-12).
 * - `siblingGroupId`/`turnIndex`: mirror the emitting message's own columns
 *   (chat-messages.ts) so `is_stale` can detect a newer turn or a
 *   regenerate-switched active sibling (D-12) without a join back through
 *   chat_messages at read time.
 *
 * `idx_chat_widget_interactions_message_part` is a UNIQUE index on
 * (message_id, part_index) — one interaction row per widget part, and the
 * anchor a future ON CONFLICT could target.
 *
 * RLS: RESTRICTIVE deny-all for anon + authenticated (mirrors 0023_chat_spine.sql
 * / 0024_chat_canvas_layouts.sql — T-24-03 mitigation). service_role / postgres
 * (the Python FastAPI backend) bypass RLS by design.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ChatConversations } from "./chat-conversations";
import { ChatMessages } from "./chat-messages";

// ---------------------------------------------------------------------------
// chat_widget_interactions
// ---------------------------------------------------------------------------
export const ChatWidgetInteractions = pgTable(
  "chat_widget_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => ChatConversations.id, { onDelete: "cascade" }),

    // The assistant message that emitted the interactive_widget part.
    messageId: uuid("message_id")
      .notNull()
      .references(() => ChatMessages.id, { onDelete: "cascade" }),

    // Index of the interactive_widget part within that message's parts array.
    partIndex: integer("part_index").notNull(),

    // Mirrors the emitting message's turn_index (D-12 staleness: a strictly
    // newer turn_index elsewhere in the conversation marks this stale).
    turnIndex: integer("turn_index").notNull(),

    // Mirrors the emitting message's sibling_group_id (D-12 staleness: a
    // regenerate that switches the active sibling marks this stale). Nullable
    // — the emitting message may never have been regenerated.
    siblingGroupId: uuid("sibling_group_id"),

    widgetKind: text("widget_kind").notNull(),

    // Full widget declaration (incl. proposal option id->value map) — the
    // server resolves the chosen payload from THIS, never from client input.
    declaration: jsonb("declaration").notNull(),

    // D-01/D-10: the declared JSON Schema stored at emit time, re-validated
    // against on submit (never a client-supplied schema).
    declaredResponseSchema: jsonb("declared_response_schema").notNull(),

    // pending | submitted | superseded | stale (D-02/D-11/D-12).
    state: text("state").notNull().default("pending"),

    // Populated only once state transitions to 'submitted'.
    submittedValue: jsonb("submitted_value"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // One interaction per widget part — also the DB-level double-submit lock's
    // natural anchor (D-11's actual lock is the conditional
    // `WHERE state='pending'` UPDATE in the Supabase adapter, not this index).
    chatWidgetInteractionsMessagePartIdx: uniqueIndex(
      "idx_chat_widget_interactions_message_part",
    ).on(t.messageId, t.partIndex),
    chatWidgetInteractionsConversationIdx: index(
      "idx_chat_widget_interactions_conversation_id",
    ).on(t.conversationId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ChatWidgetInteractionRow = typeof ChatWidgetInteractions.$inferSelect;
export type InsertChatWidgetInteraction = typeof ChatWidgetInteractions.$inferInsert;
