import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@nauta/db/client";
import { EmailAttachments } from "@nauta/db/schema";

// UUID v4 regex — validates the path param before hitting the DB
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // ── Input validation ───────────────────────────────────────────────────────
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid attachment id" },
      { status: 400 },
    );
  }

  // ── Missing-secret guard (T-05-09) ─────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[attachments/[id]] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured",
    );
    return NextResponse.json(
      { error: "Storage is not configured" },
      { status: 500 },
    );
  }

  // ── DB lookup ──────────────────────────────────────────────────────────────
  let storageKey: string | null;

  try {
    const rows = await db
      .select({ storageKey: EmailAttachments.storageKey })
      .from(EmailAttachments)
      .where(eq(EmailAttachments.id, id))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    storageKey = rows[0].storageKey;
  } catch (err) {
    console.error("[attachments/[id]] DB error:", err);
    return NextResponse.json(
      { error: "Failed to generate download link" },
      { status: 500 },
    );
  }

  if (!storageKey) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 },
    );
  }

  // ── Signed URL generation ──────────────────────────────────────────────────
  // 3600s TTL; cached on the client for 55 min (T-05-08)
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.storage
    .from("email-attachments")
    .createSignedUrl(storageKey, 3600);

  if (error) {
    console.error("[attachments/[id]] Storage error:", error);
    return NextResponse.json(
      { error: "Failed to generate download link" },
      { status: 500 },
    );
  }

  // Only { url } reaches the browser — service-role key never leaves the server
  return NextResponse.json({ url: data.signedUrl });
}
