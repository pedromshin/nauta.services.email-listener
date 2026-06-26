/**
 * getStatusBadge — shared status badge variant+className resolver.
 *
 * Used by both fields-panel.tsx and entities-list.tsx to ensure consistent
 * badge rendering across the email detail review surface.
 *
 * Status values per 06-UI-SPEC §6.6:
 * - pending    → secondary  (default for unprocessed)
 * - candidate  → default    (accepted into extraction queue)
 * - rejected   → outline + line-through text
 * - superseded → secondary + opacity-60 (historical, still auditable)
 */
export function getStatusBadge(status: string): {
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
} {
  if (status === "rejected") {
    return { variant: "outline", className: "line-through" };
  }
  if (status === "superseded") {
    return { variant: "secondary", className: "opacity-60" };
  }
  if (status === "candidate") {
    return { variant: "default" };
  }
  // pending + anything else
  return { variant: "secondary" };
}
