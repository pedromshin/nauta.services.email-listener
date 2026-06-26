CREATE TYPE "public"."knowledge_node_scope" AS ENUM('entity_type', 'entity_instance', 'sender', 'importer_global');--> statement-breakpoint
CREATE TABLE "component_entity_candidate_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"entity_instance_id" uuid NOT NULL,
	"entity_type_id" uuid NOT NULL,
	"similarity_score" real NOT NULL,
	"match_type" text,
	"was_selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_entity_candidate_links_component_entity_unique" UNIQUE("component_id","entity_instance_id")
);
--> statement-breakpoint
CREATE TABLE "component_knowledge_node_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"knowledge_node_id" uuid NOT NULL,
	"similarity_score" real NOT NULL,
	"retrieval_method" text,
	"used_in_extraction" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_knowledge_node_links_component_node_unique" UNIQUE("component_id","knowledge_node_id")
);
--> statement-breakpoint
CREATE TABLE "entity_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"entity_type_id" uuid NOT NULL,
	"nauta_id" text NOT NULL,
	"display_name" text NOT NULL,
	"identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aliases" text[],
	"summary_text" text,
	"embedding" halfvec(1536),
	"last_synced_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_instances_importer_entity_type_nauta_id_unique" UNIQUE("importer_id","entity_type_id","nauta_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"scope" "knowledge_node_scope" NOT NULL,
	"scope_ref_id" uuid,
	"scope_ref_type" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"embedding" halfvec(1536),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"email_address" text NOT NULL,
	"display_name" text,
	"category" text,
	"is_noise" boolean DEFAULT false NOT NULL,
	"notes" text,
	"linked_entity_instance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sender_profiles_importer_email_unique" UNIQUE("importer_id","email_address")
);
--> statement-breakpoint
ALTER TABLE "component_entity_candidate_links" ADD CONSTRAINT "component_entity_candidate_links_component_id_email_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."email_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_entity_candidate_links" ADD CONSTRAINT "component_entity_candidate_links_entity_instance_id_entity_instances_id_fk" FOREIGN KEY ("entity_instance_id") REFERENCES "public"."entity_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_entity_candidate_links" ADD CONSTRAINT "component_entity_candidate_links_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_knowledge_node_links" ADD CONSTRAINT "component_knowledge_node_links_component_id_email_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."email_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_knowledge_node_links" ADD CONSTRAINT "component_knowledge_node_links_knowledge_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("knowledge_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_instances" ADD CONSTRAINT "entity_instances_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_instances" ADD CONSTRAINT "entity_instances_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_profiles" ADD CONSTRAINT "sender_profiles_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_profiles" ADD CONSTRAINT "sender_profiles_linked_entity_instance_id_entity_instances_id_fk" FOREIGN KEY ("linked_entity_instance_id") REFERENCES "public"."entity_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_component_entity_candidate_links_component_id" ON "component_entity_candidate_links" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "idx_component_knowledge_node_links_component_id" ON "component_knowledge_node_links" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "idx_entity_instances_importer_entity_type" ON "entity_instances" USING btree ("importer_id","entity_type_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_nodes_importer_scope" ON "knowledge_nodes" USING btree ("importer_id","scope");--> statement-breakpoint
CREATE INDEX "idx_knowledge_nodes_importer_active" ON "knowledge_nodes" USING btree ("importer_id","is_active");