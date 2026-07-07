"use client";

/**
 * file-tree.tsx — ADOPT-02 (27-UI-SPEC.md, "ADOPT-02 — FileTree").
 *
 * Hand-ported from Magic UI's `file-tree` component:
 *   Source:  https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/file-tree.tsx
 *   Project: magicuidesign/magicui
 *   License: MIT
 *   Fetched: 2026-07-06
 *
 * This is a TRIMMED, data-driven re-implementation, not a verbatim copy — Magic
 * UI's compound `Tree`/`Folder`/`File`/`CollapseButton` JSX-composition surface
 * is replaced with a single `<FileTree data={...} />` driven by a typed
 * `FileTreeNode[]` prop (this repo's one consumer needs a static render from
 * data, not arbitrary JSX composition — Claude's Discretion per 27-CONTEXT.md).
 * `ScrollArea`, RTL support, custom sort, and `CollapseButton` are all dropped
 * (no consumer here). Built directly on raw `@radix-ui/react-accordion` — NOT
 * `@nauta/ui`'s accordion wrapper, which bakes a bold trigger weight into its
 * base className (packages/ui/src/accordion.tsx:31) — so this component
 * carries zero inherited weight violations of its own. The selected-file-row
 * treatment (`bg-primary/10 text-primary`) is a verbatim reuse of
 * conversation-row.tsx's `isActive` recipe (Phase 26), not a new pattern.
 */

import * as React from "react";
import { useCallback, useState } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react";

import { cn } from "@nauta/ui";

export interface FileTreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: "folder" | "file";
  readonly children?: readonly FileTreeNode[];
}

export interface FileTreeProps {
  readonly data: readonly FileTreeNode[];
  readonly selectedId?: string;
  readonly onSelect?: (node: FileTreeNode) => void;
  readonly defaultExpandedIds?: readonly string[];
}

/** Shared row classes — every row is min-h-11 (44px touch target), text-sm, regular weight. */
const ROW_BASE =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-normal transition-colors";
const ROW_UNSELECTED = "text-foreground hover:bg-muted";
const ROW_SELECTED = "bg-primary/10 text-primary";
const ICON_BASE = "size-4 shrink-0 text-muted-foreground";

/** Fixed depth->indent lookup (no inline styles): depth 0 = pl-2 (8px); depth >= 1 clamps to pl-6 (24px). */
function indentClass(depth: number): string {
  return depth <= 0 ? "pl-2" : "pl-6";
}

interface FileTreeLevelProps {
  readonly nodes: readonly FileTreeNode[];
  readonly depth: number;
  readonly selectedId: string | undefined;
  readonly onSelect: ((node: FileTreeNode) => void) | undefined;
  readonly expandedIds: readonly string[];
  readonly onExpandedChange: (ids: string[]) => void;
}

/**
 * One recursion level: an Accordion root scoped to `nodes`, sharing the SAME
 * `expandedIds` array across every nesting level (mirrors Magic UI's own
 * nested-root-with-shared-state architecture), so node ids only need to be
 * unique across the whole tree, not per level.
 */
function FileTreeLevel({
  nodes,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onExpandedChange,
}: FileTreeLevelProps): React.ReactElement {
  return (
    <AccordionPrimitive.Root
      type="multiple"
      value={[...expandedIds]}
      onValueChange={onExpandedChange}
      className="flex flex-col gap-1"
    >
      {nodes.map((node) => {
        if (node.type === "file") {
          const isSelected = node.id === selectedId;
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelect?.(node)}
              className={cn(
                ROW_BASE,
                indentClass(depth),
                isSelected ? ROW_SELECTED : ROW_UNSELECTED,
              )}
            >
              <FileCode2 className={ICON_BASE} aria-hidden />
              <span className="truncate">{node.name}</span>
            </button>
          );
        }

        const isOpen = expandedIds.includes(node.id);
        const FolderGlyph = isOpen ? FolderOpen : Folder;

        return (
          <AccordionPrimitive.Item key={node.id} value={node.id} className="border-none">
            <AccordionPrimitive.Header>
              <AccordionPrimitive.Trigger
                className={cn(ROW_BASE, indentClass(depth), "group", ROW_UNSELECTED)}
              >
                <ChevronRight
                  className={cn(
                    ICON_BASE,
                    "transition-transform duration-200 group-data-[state=open]:rotate-90",
                  )}
                  aria-hidden
                />
                <FolderGlyph className={ICON_BASE} aria-hidden />
                <span className="truncate text-foreground">{node.name}</span>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <AccordionPrimitive.Content className="overflow-hidden">
              {node.children && node.children.length > 0 ? (
                <div className="ml-4 border-l border-border/40">
                  <FileTreeLevel
                    nodes={node.children}
                    depth={depth + 1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    expandedIds={expandedIds}
                    onExpandedChange={onExpandedChange}
                  />
                </div>
              ) : null}
            </AccordionPrimitive.Content>
          </AccordionPrimitive.Item>
        );
      })}
    </AccordionPrimitive.Root>
  );
}

/**
 * FileTree — data-driven file/folder tree on raw Radix Accordion primitives.
 * See FileTreeProps and 27-UI-SPEC.md's visual contract (§ ADOPT-02).
 */
export function FileTree({
  data,
  selectedId,
  onSelect,
  defaultExpandedIds,
}: FileTreeProps): React.ReactElement {
  const [expandedIds, setExpandedIds] = useState<string[]>(
    defaultExpandedIds ? [...defaultExpandedIds] : [],
  );

  const handleExpandedChange = useCallback((next: string[]): void => {
    setExpandedIds(next);
  }, []);

  return (
    <FileTreeLevel
      nodes={data}
      depth={0}
      selectedId={selectedId}
      onSelect={onSelect}
      expandedIds={expandedIds}
      onExpandedChange={handleExpandedChange}
    />
  );
}
