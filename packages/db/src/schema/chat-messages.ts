/**
 * Phase 22 — Chat Spine: chat_messages table (FOUND-1, D-16, D-18, D-27).
 *
 * The canonical typed-message-parts store. `parts` is the freely-interleaved
 * Anthropic-content-block array stored verbatim (D-18) — text, genui-spec,
 * tool-call, tool-result, widget-interaction parts all read/write ONE shape,
 * exactly as emitted. This is FOUND-1's spine: regenerate, replay, evals,
 * canvas, and cross-chat context all consume this table.
 *
 * Sibling-version turn tree (D-16): a regenerated assistant response inserts a
 * NEW row sharing the same sibling_group_id as the turn it regenerates, with
 * an incremented `version`. Only the row with is_active=true feeds subsequent
 * context and is what the `< 1/2 >` navigator shows by default.
 *
 * run_id is nullable + ON DELETE SET NULL (FOUND-5 provenance survives a run
 * row's own lifecycle without forcing message deletion).
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { ChatConversations } from "./chat-conversations";
import { ChatRuns } from "./chat-runs";

// ---------------------------------------------------------------------------
// chat_messages
// ---------------------------------------------------------------------------
export const ChatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => ChatConversations.id, { onDelete: "cascade" }),

    // FOUND-5 provenance: which run produced this message. Nullable — set null
    // if the run row is itself cleaned up independently of the message.
    runId: uuid("run_id").references(() => ChatRuns.id, {
      onDelete: "set null",
    }),

    // user | assistant | system (CHECK constraint added in migration 0023)
    role: text("role").notNull(),

    // D-18/FOUND-1: canonical interleaved typed-parts array, stored verbatim
    // as emitted (Anthropic content blocks: text | genui-spec | tool-call |
    // tool-result | widget-interaction).
    parts: jsonb("parts").notNull(),

    // Turn ordering within the conversation (0-based, monotonically increasing
    // per turn — siblings of one turn share the same turn_index).
    turnIndex: integer("turn_index").notNull(),

    // D-16: regenerations of one assistant turn share this identifier. Null
    // for turns that have never been regenerated (i.e. the only version).
    siblingGroupId: uuid("sibling_group_id"),

    // D-16: the < N/M > ordinal within a sibling group.
    version: integer("version").notNull().default(1),

    // D-16: only the active sibling feeds subsequent context / is rendered by
    // default. Exactly one row per sibling_group_id has is_active = true.
    isActive: boolean("is_active").notNull().default(true),

    // streaming | completed | stopped | failed | cost_capped | interrupted
    // (CHECK constraint added in migration 0023; D-15/D-19/D-21/D-25)
    status: text("status").notNull().default("completed"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    chatMessagesConversationTurnIdx: index(
      "idx_chat_messages_conversation_turn",
    ).on(t.conversationId, t.turnIndex),
    chatMessagesSiblingGroupIdx: index(
      "idx_chat_messages_sibling_group_id",
    ).on(t.siblingGroupId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ChatMessageRow = typeof ChatMessages.$inferSelect;
export type InsertChatMessage = typeof ChatMessages.$inferInsert;
