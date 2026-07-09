-- ---------------------------------------------------------------------------
-- Phase 40 — Confirm-Action Widgets: chat_widget_interactions.widget_kind
-- CHECK constraint extension (CONF-01).
--
-- Extends the Phase-24 `chat_widget_interactions_widget_kind_check` CHECK
-- constraint (defined in 0025_chat_widget_interactions.sql:
--   CHECK (widget_kind IN ('proposal_cards', 'clarify_widget')))
-- with a third value, `'confirm_action'`, for Phase 40's `emit_confirm_action`
-- terminal widget tool — the model supplies only a `suggestionRef {kind, id}`
-- and the server re-reads the live `knowledge_node_edges` row to build a
-- frozen confirm/reject widget declaration (never a mutation parameter).
--
-- A CHECK constraint cannot be ALTERed in place, so this is
-- DROP CONSTRAINT IF EXISTS + re-ADD (idempotent, mirrors 0026/0027's
-- style). Re-applying this migration is a no-op.
-- ---------------------------------------------------------------------------

ALTER TABLE "chat_widget_interactions" DROP CONSTRAINT IF EXISTS "chat_widget_interactions_widget_kind_check";
--> statement-breakpoint
ALTER TABLE "chat_widget_interactions" ADD CONSTRAINT "chat_widget_interactions_widget_kind_check" CHECK (widget_kind IN ('proposal_cards', 'clarify_widget', 'confirm_action'));
