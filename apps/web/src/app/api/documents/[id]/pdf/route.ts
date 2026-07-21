/**
 * apps/web/src/app/api/documents/[id]/pdf/route.ts
 *
 * DOCS-01 — the PDF EXPORT handler. Renders the typeset print route
 * (../../../../documents/[id]/print) to a real PDF with a headless Chromium via
 * playwright-core, and streams the buffer back. The output is a TYPESET
 * DOCUMENT — @page-sized, serif evidence body, 45–75ch measure, provenance
 * marks preserved — not a screenshot of a web page (Phase 70 acceptance 1).
 *
 * ── Why print-a-real-route rather than build an HTML string here ──
 * The one model ({@link loadReportDocument}) is rendered by ONE renderer
 * (TypesetDocument) on the print route, and this handler photographs THAT. So
 * the on-screen HTML read and the PDF can never diverge, and there is a single
 * place the typeset layout lives.
 *
 * ── Auth ──
 * Server-verified getUser() only (never getSession() — an unverified cookie
 * parse), mirroring the attachments download route. 401 on no user. The
 * per-document OWNERSHIP gate lands with the document STORE (DOCS-02); the
 * loader is a store seam today, so this floor gates on authentication and
 * fail-closed 404s an unknown id.
 *
 * ── Runtime ──
 * Node (Chromium cannot launch on the edge runtime); dynamic (per-request).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { loadStoredDocument } from "../../../../documents/_lib/document-store";
import { loadReportDocument } from "../../../../documents/_lib/report-document";
import { createClient as createSupabaseServerClient } from "~/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The installed Chromium. The environment ships it at /opt/pw-browsers with a
 * `chromium` symlink pointing straight at the chrome binary; PLAYWRIGHT_BROWSERS_PATH
 * lets playwright-core resolve it too. Env override kept for portability.
 */
const CHROMIUM_EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // ── Session identity — server-verified, never getSession() ──────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fail-closed existence check (no oracle: same 404 as "not yours") ─────
  // DOCS-02: prefer the owner-scoped DB store (ownership gated on the verified
  // user above); the built-in sample registry is the floor-demo fallback.
  const doc =
    (await loadStoredDocument(id, user.id)) ?? (await loadReportDocument(id));
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // ── Render the typeset print route to PDF ────────────────────────────────
  // Dynamic import so playwright-core is only loaded on this Node route and
  // never bundled into any client/edge path.
  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch (err) {
    console.error("[documents/pdf] playwright-core is not installed:", err);
    return NextResponse.json(
      { error: "PDF export is not available" },
      { status: 500 },
    );
  }

  const printUrl = new URL(
    `/documents/${encodeURIComponent(id)}/print`,
    req.nextUrl.origin,
  ).toString();

  let browser: import("playwright-core").Browser | null = null;
  try {
    browser = await chromium.launch({
      executablePath: CHROMIUM_EXECUTABLE,
      headless: true,
      // Hardened flags for a sandboxed server container.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    // Forward the caller's cookies so the print route renders as the SAME
    // authenticated user once the store (DOCS-02) gates the print route too.
    const cookieHeader = req.headers.get("cookie");
    const context = await browser.newContext(
      cookieHeader
        ? { extraHTTPHeaders: { cookie: cookieHeader } }
        : undefined,
    );
    const page = await context.newPage();

    const response = await page.goto(printUrl, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!response || !response.ok()) {
      const status = response?.status() ?? 502;
      console.error(
        `[documents/pdf] print route returned ${status} for ${printUrl}`,
      );
      return NextResponse.json(
        { error: "Failed to render document" },
        { status: 502 },
      );
    }

    // Wait for the typeset sheet to be present before capturing.
    await page.waitForSelector(".ts-sheet", { timeout: 10_000 });

    const pdf = await page.pdf({
      // Honour the print route's own @page size/margins (print.css).
      preferCSSPageSize: true,
      // Keep the locked washes/marks (pmark tints, evidence rule) — the engine
      // strips backgrounds by default, which would erase provenance.
      printBackground: true,
    });

    const filename = `${slugify(doc.title) || "document"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[documents/pdf] export failed:", err);
    return NextResponse.json(
      { error: "Failed to export PDF" },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close();
  }
}

/** Filesystem-safe slug for the download filename. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
