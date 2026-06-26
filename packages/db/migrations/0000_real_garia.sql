CREATE TYPE "public"."component_source_type" AS ENUM('email_body', 'attachment_page', 'attachment_sheet', 'attachment_section', 'attachment_whole');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('candidate', 'auto_confirmed', 'review_pending', 'confirmed', 'rejected', 'superseded');--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"email_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint,
	"storage_key" text,
	"page_count" integer,
	"sheet_count" integer,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"parsed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"email_id" uuid NOT NULL,
	"attachment_id" uuid,
	"parent_component_id" uuid,
	"sequence_index" integer DEFAULT 0 NOT NULL,
	"source_type" "component_source_type" NOT NULL,
	"location" jsonb,
	"content_text" text,
	"content_markdown" text,
	"content_raw" jsonb,
	"embedding" halfvec(1536),
	"extraction_status" "extraction_status" DEFAULT 'candidate' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"in_reply_to" text,
	"references_ids" text[],
	"received_at" timestamp with time zone NOT NULL,
	"sender_address" text NOT NULL,
	"sender_name" text,
	"to_addresses" text[] NOT NULL,
	"cc_addresses" text[],
	"subject" text,
	"body_html" text,
	"body_text" text,
	"raw_storage_key" text,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"parsed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_type_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type_id" uuid NOT NULL,
	"importer_id" uuid,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"field_type" text DEFAULT 'string' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"embedding" halfvec(1536),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_types_importer_id_slug_unique" UNIQUE("importer_id","slug")
);
--> statement-breakpoint
CREATE TABLE "extraction_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importer_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"entity_type_id" uuid NOT NULL,
	"extracted_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"corrected_fields" jsonb,
	"retrieval_context" jsonb,
	"confidence_score" numeric(5, 4),
	"status" "extraction_status" DEFAULT 'candidate' NOT NULL,
	"reviewer_note" text,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "importers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_components" ADD CONSTRAINT "email_components_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_components" ADD CONSTRAINT "email_components_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_components" ADD CONSTRAINT "email_components_attachment_id_email_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."email_attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type_fields" ADD CONSTRAINT "entity_type_fields_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_type_fields" ADD CONSTRAINT "entity_type_fields_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_types" ADD CONSTRAINT "entity_types_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_records" ADD CONSTRAINT "extraction_records_importer_id_importers_id_fk" FOREIGN KEY ("importer_id") REFERENCES "public"."importers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_records" ADD CONSTRAINT "extraction_records_component_id_email_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."email_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_records" ADD CONSTRAINT "extraction_records_entity_type_id_entity_types_id_fk" FOREIGN KEY ("entity_type_id") REFERENCES "public"."entity_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_attachments_email_id" ON "email_attachments" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_email_attachments_importer_id" ON "email_attachments" USING btree ("importer_id");--> statement-breakpoint
CREATE INDEX "idx_email_components_email_id" ON "email_components" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "idx_email_components_attachment_id" ON "email_components" USING btree ("attachment_id");--> statement-breakpoint
CREATE INDEX "idx_email_components_importer_id" ON "email_components" USING btree ("importer_id");--> statement-breakpoint
CREATE INDEX "idx_email_components_parent_id" ON "email_components" USING btree ("parent_component_id");--> statement-breakpoint
CREATE INDEX "idx_email_components_extraction_status" ON "email_components" USING btree ("extraction_status");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_importer_id_message_id_unique" ON "emails" USING btree ("importer_id","message_id");--> statement-breakpoint
CREATE INDEX "idx_emails_importer_id_received_at" ON "emails" USING btree ("importer_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_entity_type_fields_entity_type_id" ON "entity_type_fields" USING btree ("entity_type_id");--> statement-breakpoint
CREATE INDEX "idx_entity_type_fields_importer_id" ON "entity_type_fields" USING btree ("importer_id");--> statement-breakpoint
CREATE INDEX "idx_entity_types_importer_id" ON "entity_types" USING btree ("importer_id");--> statement-breakpoint
CREATE INDEX "idx_entity_types_slug" ON "entity_types" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_extraction_records_component_id" ON "extraction_records" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "idx_extraction_records_entity_type_id" ON "extraction_records" USING btree ("entity_type_id");--> statement-breakpoint
CREATE INDEX "idx_extraction_records_importer_id" ON "extraction_records" USING btree ("importer_id");--> statement-breakpoint
CREATE INDEX "idx_extraction_records_status" ON "extraction_records" USING btree ("status");