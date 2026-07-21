import "./print.css";

/**
 * apps/web/src/app/documents/[id]/print/layout.tsx
 *
 * Loads the typeset stylesheet (App Router: global CSS may be imported by any
 * layout) for the print route only, so the sheet-of-paper rules and the
 * shell-isolation rules apply here and nowhere else. The route still nests
 * under the app root layout; print.css + PrintChromeReset strip the shell.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
