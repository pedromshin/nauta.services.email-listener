"use client";

/**
 * filter-rail.tsx — the node-type filter rail for the /knowledge graph surface.
 *
 * ── PHASE 62 REDESIGN (SURF-03, D-58-01) ──
 * Rebuilt on the locked identity, not re-tokened. The old rail keyed each node
 * type to a coloured dot from the retired `graph-*` family — role encoded as
 * hue, which law 3 forbids ("Entity type is shape, never hue"). The taste layer
 * names this rail explicitly as "the legitimate home for law-3 type shapes (no
 * room for words)": every type now reads as an ink GLYPH, never a colour. Colour
 * on this surface is spent only where it is earned — the tier legend and the
 * tier filter — never on chrome.
 *
 * Ground ladder: the rail is a `leaf` panel one step above the `shelf` board;
 * the active facet is a `shade` well with ink weight, mirroring the inbox
 * FiltersRail redesign (Phase 60). Zero shadow, hairline rules.
 *
 * Presentational: all state + handlers injected via props from knowledge-graph.tsx.
 */

import type { LucideIcon } from "lucide-react";
import { Box, Hash, Layers, Mail, Shapes, Share2 } from "lucide-react";

import { Separator } from "@polytoken/ui/separator";
import { Switch } from "@polytoken/ui/switch";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Node types shown in the filter rail. Exported (53-06-PLAN.md Task 1) so
 * `KnowledgeMobileList` reuses the EXACT facet data + glyph — one vocabulary.
 *
 * `icon` carries a lucide glyph in place of the retired coloured dot: on this
 * chrome the type is a SHAPE (law 3), drawn in `--faded` so it never out-shouts
 * the one place colour is allowed to live (tier). The glyph matches the one the
 * node itself wears on the canvas — one mark per type, everywhere.
 */
export const NODE_TYPE_ROWS = [
  { type: "entity_type" as const, label: "Entity types", icon: Shapes },
  { type: "entity_type_field" as const, label: "Fields", icon: Hash },
  { type: "entity_instance" as const, label: "Instances", icon: Box },
  { type: "email" as const, label: "Emails", icon: Mail },
  { type: "email_component" as const, label: "Components", icon: Layers },
  { type: "knowledge_node" as const, label: "Knowledge rules", icon: Share2 },
] as const;

export type NodeTypeKey =
  | "entity_type"
  | "entity_type_field"
  | "entity_instance"
  | "email"
  | "email_component"
  | "knowledge_node";

/** The glyph for a node type — the same mark the canvas node wears. */
const ICON_BY_TYPE = new Map<string, LucideIcon>(
  NODE_TYPE_ROWS.map((row) => [row.type, row.icon]),
);

export function nodeTypeIcon(type: string): LucideIcon {
  return ICON_BY_TYPE.get(type) ?? Box;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterRailCounts {
  readonly types: number;
  readonly fields: number;
  readonly instances: number;
}

interface FilterRailProps {
  readonly visibleTypes: ReadonlySet<NodeTypeKey>;
  readonly onToggleType: (type: NodeTypeKey) => void;
  readonly showInstances: boolean;
  readonly onToggleInstances: (value: boolean) => void;
  readonly counts: FilterRailCounts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterRail({
  visibleTypes,
  onToggleType,
  showInstances,
  onToggleInstances,
  counts,
}: FilterRailProps): React.ReactElement {
  return (
    <div className="flex h-full w-60 flex-col border-r border-hair bg-leaf">
      {/* Micro-label header — the inbox rail's register (Phase 60). */}
      <p className="px-panel pb-2 pt-panel text-2xs font-semibold uppercase tracking-[0.07em] text-pencil">
        Show
      </p>

      {/* Node-type facets — each carries an ink glyph (law 3: shape, not hue). */}
      <div className="flex flex-col gap-0.5 px-2">
        {NODE_TYPE_ROWS.map(({ type, label, icon: Icon }) => {
          const checked = visibleTypes.has(type);
          return (
            <label
              key={type}
              className={`group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                checked
                  ? "bg-shade text-ink"
                  : "text-faded hover:bg-shade hover:text-ink"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleType(type)}
                className="peer sr-only"
                aria-label={label}
              />
              {/* Type glyph — --faded so it defers to tier's earned colour. */}
              <Icon
                className="size-3.5 shrink-0 text-faded"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className={checked ? "font-semibold" : ""}>{label}</span>
              {/* Ink check — selection is ink weight + fill, never a hue (law 1). */}
              <span
                className={`ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 ${
                  checked
                    ? "border-ink bg-ink text-on-fill"
                    : "border-rule bg-bright"
                }`}
                aria-hidden
              >
                {checked && (
                  <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
                    <polyline
                      points="1.5,5 4,7.5 8.5,2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <Separator className="my-3 bg-hair" />

      {/* Show-all-instances — inline toggle, progressive-disclosure register. */}
      <div className="px-panel">
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span className="text-sm text-ink">Show all instances</span>
          <Switch
            checked={showInstances}
            onCheckedChange={onToggleInstances}
            aria-label="Show all instances"
          />
        </label>
        <p className="mt-1 text-xs leading-relaxed text-pencil">
          May slow rendering on large graphs.
        </p>
      </div>

      <div className="flex-1" />

      {/* Footer counts — tabular numerals (law 2). */}
      <p className="tabular border-t border-hair px-panel py-3 text-xs text-pencil">
        {counts.types} types · {counts.fields} fields · {counts.instances}{" "}
        instances
      </p>
    </div>
  );
}
