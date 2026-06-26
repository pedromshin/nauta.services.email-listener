CREATE TABLE "knowledge_node_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_ref_id" uuid,
	"target_ref_type" text,
	"relation_type" text DEFAULT 'related' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_node_edges" ADD CONSTRAINT "knowledge_node_edges_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_node_edges_source_node_id" ON "knowledge_node_edges" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_node_edges_target_ref_id" ON "knowledge_node_edges" USING btree ("target_ref_id");