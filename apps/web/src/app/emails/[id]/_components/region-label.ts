/**
 * region-label — shared helpers for deriving a human-readable label from a
 * region's detected text (B1).
 *
 * Unclassified/candidate regions have no entity-type label, so the LAYERS rows
 * and the on-PDF box chips previously fell back to the raw extraction_status
 * ("pending"/"candidate"). That is meaningless as a label; the detected text is
 * what the operator needs to recognize the region. These helpers collapse and
 * truncate that text for compact display.
 */

/** Default max length for a compact region label snippet. */
const DEFAULT_SNIPPET_MAX = 48;

/**
 * Collapse whitespace and truncate a region's detected text into a compact,
 * single-line label. Returns null when there is no usable text so callers can
 * fall back (entity-type label → snippet → status).
 */
export function contentSnippet(
  text: string | null | undefined,
  max: number = DEFAULT_SNIPPET_MAX,
): string | null {
  if (text === null || text === undefined) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}
