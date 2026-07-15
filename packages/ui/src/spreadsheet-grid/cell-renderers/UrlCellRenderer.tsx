import type { ICellRendererParams } from "ag-grid-community";
import { ExternalLink } from "lucide-react";
import type { JSX } from "react";

/** Renders a truncated URL with an external link icon (D-09) */
export function UrlCellRenderer(
  params: ICellRendererParams,
): JSX.Element | null {
  const value: unknown = params.value;

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const url = typeof value === "string" ? value : "";

  return (
    <div className="flex w-full items-center gap-1 overflow-hidden">
      <span className="inline-block max-w-[200px] truncate">{url}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Open ${url} in new tab`}
      >
        <ExternalLink size={12} />
      </a>
    </div>
  );
}
