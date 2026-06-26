ALTER TABLE "email_attachments" ADD COLUMN IF NOT EXISTS "file_ext" text;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD COLUMN IF NOT EXISTS "parent_attachment_id" uuid;