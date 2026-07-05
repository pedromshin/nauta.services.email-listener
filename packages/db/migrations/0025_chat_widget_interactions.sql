-- ---------------------------------------------------------------------------
-- Phase 24 — Dual-Channel GenUI: chat_widget_interactions (DCUI-04, D-01,
-- D-10, D-11, D-12).
--
-- Persistence + safety-primitive spine for agent<->user widget round-trips:
-- one row per emitted interactive_widget part, tracking its lifecycle
-- (pending -> submitted | superseded | stale) and the DECLARED response
-- schema submitted results are re-validated against (D-01/D-10 — the schema
-- lives HERE, never client-supplied). The DB-level double-submit lock (D-11)
-- is the conditional `WHERE state='pending'` UPDATE the Supabase adapter
-- issues, not a constraint on this table.
-- RLS:  RESTRICTIVE deny-all for anon + authenticated (mirrors
--       0023_chat_spine.sql / 0024_chat_canvas_layouts.sql — T-24-03
--       mitigation). service_role / postgres (the Python FastAPI backend)
--       bypass RLS by design.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "chat_widget_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"part_index" integer NOT NULL,
	"turn_index" integer NOT NULL,
	"sibling_group_id" uuid,
	"widget_kind" text NOT NULL,
	"declaration" jsonb NOT NULL,
	"declared_response_schema" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"submitted_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_widget_interactions_widget_kind_check" CHECK (widget_kind IN ('proposal_cards', 'clarify_widget')),
	CONSTRAINT "chat_widget_interactions_state_check" CHECK (state IN ('pending', 'submitted', 'superseded', 'stale'))
);
--> statement-breakpoint
ALTER TABLE "chat_widget_interactions" ADD CONSTRAINT "chat_widget_interactions_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_widget_interactions" ADD CONSTRAINT "chat_widget_interactions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_chat_widget_interactions_message_part" ON "chat_widget_interactions" USING btree ("message_id","part_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_widget_interactions_conversation_id" ON "chat_widget_interactions" USING btree ("conversation_id");--> statement-breakpoint
-- RLS deny-all baseline (mirrors 0023_chat_spine.sql / 0024_chat_canvas_layouts.sql) --
ALTER TABLE "chat_widget_interactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_chat_widget_interactions_anon" ON "chat_widget_interactions";--> statement-breakpoint
CREATE POLICY "deny_all_chat_widget_interactions_anon" ON "chat_widget_interactions"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_chat_widget_interactions_authenticated" ON "chat_widget_interactions";--> statement-breakpoint
CREATE POLICY "deny_all_chat_widget_interactions_authenticated" ON "chat_widget_interactions"
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);
