import type { ICellRendererParams } from "ag-grid-community";
import * as React from "react";

import { Badge } from "../../badge";

const MAX_VISIBLE = 3;

/** Renders array items as Badge chips, showing up to 3 with overflow count (D-09) */
export function ArrayCellRenderer(
  params: ICellRendererParams,
): JSX.Element | null {
  const value: unknown = params.value;

  if (value === null || value === undefined) {
    return null;
  }

  const items: unknown[] = Array.isArray(value) ? value : [value];

  if (items.length === 0) {
    return null;
  }

  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap items-center gap-1 py-0.5">
      {visible.map((item, idx) => (
        <Badge key={idx} variant="secondary" className="px-1.5 py-0 text-xs">
          {String(item)}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="px-1.5 py-0 text-xs">
          +{overflow} more
        </Badge>
      )}
    </div>
  );
}
