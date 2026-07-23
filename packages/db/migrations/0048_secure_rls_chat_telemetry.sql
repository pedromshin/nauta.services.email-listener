-- Enable RLS on the three tables that were shipped without it, closing a
-- cross-tenant read hole: with public signup enabled, any anon key holder (and
-- any signed-up user) could SELECT every row of these tables via PostgREST.
-- Matches the existing convention exactly (deny_all_<t>_anon RESTRICTIVE +
-- <t>_owner_authenticated PERMISSIVE owner-scoped). Service-role/BFF access
-- bypasses RLS and is unaffected.
--
-- Scoping columns (verified against live prod):
--   chat_source_ledger.importer_id      -> importers.user_id
--   genui_generation_events.importer_id -> importers.user_id
--   chat_context_edges.target_conversation_id (NOT NULL) -> chat_conversations.user_id

-- chat_source_ledger — importer-anchored (join through importers.user_id)
ALTER TABLE "chat_source_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_chat_source_ledger_anon" ON "chat_source_ledger"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "chat_source_ledger_owner_authenticated" ON "chat_source_ledger"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()))
  WITH CHECK (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()));
--> statement-breakpoint

-- genui_generation_events — importer-anchored (join through importers.user_id)
ALTER TABLE "genui_generation_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_genui_generation_events_anon" ON "genui_generation_events"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "genui_generation_events_owner_authenticated" ON "genui_generation_events"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()))
  WITH CHECK (importer_id IN (SELECT id FROM importers WHERE user_id = auth.uid()));
--> statement-breakpoint

-- chat_context_edges — conversation-anchored (join through chat_conversations.user_id)
ALTER TABLE "chat_context_edges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "deny_all_chat_context_edges_anon" ON "chat_context_edges"
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY "chat_context_edges_owner_authenticated" ON "chat_context_edges"
  AS PERMISSIVE FOR ALL TO authenticated
  USING (target_conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()))
  WITH CHECK (target_conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()));
