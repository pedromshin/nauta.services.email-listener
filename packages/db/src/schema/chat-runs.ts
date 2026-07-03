/**
 * Phase 22 — Chat Spine: chat_runs table (SEAM-03/04, D-27).
 *
 * One run per agent turn today (one-agent, one-run-per-turn — SEAM-04). The
 * event-based run/run_events model keeps room for multi-agent/multi-run turns
 * later without a schema change (FOUND-5 provenance).
 *
 * status values (enforced by SQL CHECK in migration 0023):
 *   running | completed | stopped | failed | cost_capped | interrupted
 * (D-15 stop, D-21 cost breaker, D-25 disconnect-mid-stream).
 */

import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { ChatConversations } from "./chat-conversations";

// ---------------------------------------------------------------------------
// chat_runs
// ---------------------------------------------------------------------------
export const ChatRuns = pgTable(
  "chat_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => ChatConversations.id, { onDelete: "cascade" }),

    // SEAM-04: one-agent-today identifier, e.g. "chat-agent-v1".
    agentId: text("agent_id").notNull(),

    modelId: text("model_id").notNull(),

    // running | completed | stopped | failed | cost_capped | interrupted
    // (CHECK constraint added in migration 0023)
    status: text("status").notNull(),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    chatRunsConversationIdx: index("idx_chat_runs_conversation_id").on(
      t.conversationId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ChatRunRow = typeof ChatRuns.$inferSelect;
export type InsertChatRun = typeof ChatRuns.$inferInsert;
