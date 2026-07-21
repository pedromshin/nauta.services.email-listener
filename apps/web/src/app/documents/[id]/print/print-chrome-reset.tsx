"use client";

import { useEffect } from "react";

/**
 * apps/web/src/app/documents/[id]/print/print-chrome-reset.tsx
 *
 * Stamps `data-print-mode` on <html> for the lifetime of the print route, then
 * removes it on unmount. print.css keys ALL of its shell-isolation rules off
 * that attribute (hide the sidebar, neutralise the SidebarInset <main>, paint
 * the paper ground), so a document renders shell-free even though it nests
 * under the app's root layout.
 *
 * Deterministic by design: the isolation does not depend on print-vs-screen
 * media emulation, so the same clean sheet shows in a browser tab AND in
 * playwright's page.pdf() capture (../../../api/documents/[id]/pdf).
 *
 * Renders nothing.
 */
export function PrintChromeReset(): null {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-print-mode");
    root.setAttribute("data-print-mode", "");
    return () => {
      if (prev === null) root.removeAttribute("data-print-mode");
      else root.setAttribute("data-print-mode", prev);
    };
  }, []);

  return null;
}
