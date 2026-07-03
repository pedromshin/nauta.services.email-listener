/**
 * Phase 22 — Chat Spine: chat_run_events table (SEAM-03, D-27, T-22-03).
 *
 * Append-only event log for a chat_runs row. `seq` orders events within a
 * run; the (run_id, seq) unique index is both the ordering contract and a
 * natural ON CONFLICT DO NOTHING target for idempotent event writers.
 *
 * type values (CHECK constraint added in migration 0023):
 *   started | text_delta_checkpoint | tool_call | tool_result | usage |
 *   completed | stopped | failed | cost_capped | interrupted
 *
 * No UPDATE/DELETE paths are planned for this table (T-22-03 repudiation
 * mitigation) — the application only ever appends new rows.
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

import { ChatRuns } from "./chat-runs";

// ---------------------------------------------------------------------------
// chat_run_events
// ---------------------------------------------------------------------------
export const ChatRunEvents = pgTable(
  "chat_run_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    runId: uuid("run_id")
      .notNull()
      .references(() => ChatRuns.id, { onDelete: "cascade" }),

    // Ordering within a run — 0-based, monotonically increasing.
    seq: integer("seq").notNull(),

    // started | text_delta_checkpoint | tool_call | tool_result | usage |
    // completed | stopped | failed | cost_capped | interrupted
    type: text("type").notNull(),

    // Event payload — shape depends on `type` (e.g. usage carries token
    // counts, tool_call carries the tool name + input, etc).
    data: jsonb("data").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    chatRunEventsRunSeqIdx: uniqueIndex("idx_chat_run_events_run_seq").on(
      t.runId,
      t.seq,
    ),
    chatRunEventsRunIdx: index("idx_chat_run_events_run_id").on(t.runId),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ChatRunEventRow = typeof ChatRunEvents.$inferSelect;
export type InsertChatRunEvent = typeof ChatRunEvents.$inferInsert;
