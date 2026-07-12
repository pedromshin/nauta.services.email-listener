/**
 * format-relative-time.ts — formatRelativeTime: the exact relative-time
 * vocabulary the studio's History tab already established
 * (apps/web/src/app/studio/_components/history-island.tsx, function at
 * ~line 59), extracted to a shared module (52-04-PLAN.md Task 1) so the
 * canvas Version History popover (52-UI-SPEC.md Component 4, PANL-03)
 * reuses the SAME strings VERBATIM rather than inventing a second
 * relative-time vocabulary (52-UI-SPEC.md's explicit instruction).
 *
 * Pure, degrade-not-throw: an unparsable ISO string returns the raw input
 * unchanged rather than throwing or rendering "Invalid Date" — mirrors the
 * studio original's identical fallback.
 */

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}
