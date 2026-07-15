CREATE TABLE "chat_context_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_conversation_id" uuid NOT NULL,
	"source_ref" jsonb NOT NULL,
	"source_ref_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_source_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"importer_id" uuid,
	"tool_name" text NOT NULL,
	"tool_use_id" text NOT NULL,
	"result_index" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"knowledge_node_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_context_edges" ADD CONSTRAINT "chat_context_edges_target_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("target_conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_source_ledger" ADD CONSTRAINT "chat_source_ledger_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_source_ledger" ADD CONSTRAINT "chat_source_ledger_knowledge_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_context_edges_target_conversation_id" ON "chat_context_edges" USING btree ("target_conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chat_context_edges_active_identity" ON "chat_context_edges" USING btree ("target_conversation_id","source_ref_key") WHERE is_active;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_chat_source_ledger_dedupe" ON "chat_source_ledger" USING btree ("conversation_id","tool_use_id","result_index");--> statement-breakpoint
CREATE INDEX "idx_chat_source_ledger_conversation_id" ON "chat_source_ledger" USING btree ("conversation_id");