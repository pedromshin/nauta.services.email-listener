"use client";

/**
 * node-detail-pane.tsx — 320px detail pane for the /knowledge graph surface (RSKN-03: solid, no blur).
 *
 * UI-SPEC Node Detail Pane:
 *   role="complementary" aria-label="Node details"
 *   Default: Share2 icon + "Click any node to explore it"
 *   Selected: ScrollArea with header (type Badge + label) + close X + per-type section
 *
 * Per-type sections:
 *   entity_type     — Badge "Entity Type", Fields chips, "View N instances →"
 *   entity_type_field — Badge "Field", Type row, Belongs-to (clickable)
 *   entity_instance — Badge "Instance" graph-entity, "Open entity →" → /entities/{id}
 *   email_component — Badge "Component" graph-email-component, Email row, Matched/Unmatched
 *   email           — Badge "Email", subject, From, Received
 *   knowledge_node  — Reuses EntityKnowledge card structure (Badge "Knowledge Rule" teal,
 *                     content, Source, confidence %, format(createdAt,"PP"))
 *
 * SECURITY (T-11-05): ALL DB-origin strings rendered as plain escaped React text
 * children ({value} in JSX). NO dangerouslySetInnerHTML anywhere in this file.
 *
 * Presentational — state injected via props from knowledge-graph.tsx.
 * No font-medium (500) — UI-SPEC Note #5.
 */

import * as React from "react";
import { format } from "date-fns";
import { MousePointerClick, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@polytoken/ui/badge";
import { Button } from "@polytoken/ui/button";
import { ScrollArea } from "@polytoken/ui/scroll-area";
import { Separator } from "@polytoken/ui/separator";

import type { KnowledgeNode } from "~/app/entities/[id]/_components/entity-knowledge";

import { nodeTypeIcon } from "./filter-rail";

/**
 * ── PHASE 62 REDESIGN (SURF-03, D-58-01) ──
 * The detail pane is the /files select-updates-pane pattern: a node clicked on
 * the canvas resolves here in place, never a navigate-away. Rebuilt on the
 * identity — role hues stripped (law 3: the type is stated by its ink GLYPH and
 * a neutral badge, never the retired `graph-*` colour), links carry ink + an
 * underline (law 1: no branded action colour), chrome sits on the ground ladder
 * (`leaf` panel, `hair`/`rule` boundaries). The one link colour left is ink.
 */

/** Shared link treatment — ink + underline, never a hue (law 1). */
const DETAIL_LINK =
  "text-sm font-semibold text-ink underline underline-offset-2 decoration-rule hover:decoration-ink";

// ---------------------------------------------------------------------------
// Type definitions for node data (mirrors GraphNode shapes from graph.ts)
// ---------------------------------------------------------------------------

interface EntityTypeData {
  readonly label: string;
  readonly slug?: string | null;
  readonly fields?: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly instanceCount?: number;
  readonly [key: string]: unknown;
}

interface EntityTypeFieldData {
  readonly label: string;
  readonly fieldType?: string | null;
  readonly entityTypeId?: string | null;
  readonly entityTypeName?: string | null;
  readonly [key: string]: unknown;
}

interface EntityInstanceData {
  readonly label: string;
  readonly entityTypeId?: string | null;
  readonly entityTypeName?: string | null;
  readonly [key: string]: unknown;
}

interface EmailComponentData {
  readonly label: string;
  readonly emailId?: string | null;
  readonly emailSender?: string | null;
  readonly emailSubject?: string | null;
  readonly matched?: boolean | null;
  readonly matchedInstanceName?: string | null;
  readonly [key: string]: unknown;
}

interface EmailData {
  readonly label: string;
  readonly id: string;
  readonly sender?: string | null;
  readonly receivedAt?: string | null;
  readonly [key: string]: unknown;
}

interface KnowledgeNodeData {
  readonly label: string;
  readonly content?: string | null;
  readonly source?: string | null;
  readonly confidence?: number | null;
  readonly createdAt?: string | null;
  readonly [key: string]: unknown;
}

export interface SelectedNode {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NodeDetailPaneProps {
  readonly selectedNode: SelectedNode | null;
  readonly onClose: () => void;
  readonly onSelectNode: (nodeId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-semibold uppercase tracking-[0.06em] text-pencil">
        {label}
      </span>
      <span className="text-sm text-ink">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type content blocks
// ---------------------------------------------------------------------------

function EntityTypeContent({ node }: { readonly node: SelectedNode }): React.ReactElement {
  const data = node as unknown as EntityTypeData;
  const fields = Array.isArray(data.fields) ? (data.fields as ReadonlyArray<{ id: string; label: string }>) : [];
  const instanceCount = typeof data.instanceCount === "number" ? data.instanceCount : 0;

  return (
    <div className="space-y-4">
      <Badge variant="secondary">Entity Type</Badge>

      {fields.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Fields ({fields.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((field) => (
              <Badge key={field.id} variant="outline" className="text-xs">
                {field.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <Link href={`/entities?type=${node.id}`} className={DETAIL_LINK}>
          View {instanceCount} instances &rarr;
        </Link>
      </div>
    </div>
  );
}

function EntityTypeFieldContent({
  node,
  onSelectNode,
}: {
  readonly node: SelectedNode;
  readonly onSelectNode: (nodeId: string) => void;
}): React.ReactElement {
  const data = node as unknown as EntityTypeFieldData;

  return (
    <div className="space-y-4">
      <Badge variant="secondary">Field</Badge>

      {data.fieldType != null && (
        <DetailRow label="Type">{data.fieldType}</DetailRow>
      )}

      {data.entityTypeName != null && data.entityTypeId != null && (
        <DetailRow label="Belongs to">
          <button
            type="button"
            className={DETAIL_LINK}
            onClick={() => {
              if (data.entityTypeId != null) {
                onSelectNode(data.entityTypeId);
              }
            }}
          >
            {data.entityTypeName}
          </button>
        </DetailRow>
      )}
    </div>
  );
}

function EntityInstanceContent({ node }: { readonly node: SelectedNode }): React.ReactElement {
  const data = node as unknown as EntityInstanceData;

  return (
    <div className="space-y-4">
      <Badge variant="outline">Instance</Badge>

      {data.entityTypeName != null && (
        <DetailRow label="Entity Type">{data.entityTypeName}</DetailRow>
      )}

      <div>
        <Link href={`/entities/${node.id}`} className={DETAIL_LINK}>
          Open entity &rarr;
        </Link>
      </div>
    </div>
  );
}

function EmailComponentContent({ node }: { readonly node: SelectedNode }): React.ReactElement {
  const data = node as unknown as EmailComponentData;
  const emailId = typeof data.emailId === "string" ? data.emailId : null;

  return (
    <div className="space-y-4">
      <Badge variant="outline">Component</Badge>

      {(data.emailSender != null || data.emailSubject != null) && (
        <DetailRow label="Email">
          <span>
            {data.emailSender != null ? data.emailSender : ""}
            {data.emailSender != null && data.emailSubject != null ? " · " : ""}
            {data.emailSubject != null
              ? data.emailSubject.length > 40
                ? `${data.emailSubject.slice(0, 40)}…`
                : data.emailSubject
              : ""}
          </span>
        </DetailRow>
      )}

      <DetailRow label="Match status">
        {data.matched === true
          ? data.matchedInstanceName != null
            ? data.matchedInstanceName
            : "Matched"
          : "Unmatched"}
      </DetailRow>

      {emailId != null && (
        <div>
          <Link href={`/emails/${emailId}`} className={DETAIL_LINK}>
            Open editor &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

function EmailContent({ node }: { readonly node: SelectedNode }): React.ReactElement {
  const data = node as unknown as EmailData;

  return (
    <div className="space-y-4">
      <Badge variant="outline">Email</Badge>

      {/* Subject — the user's own material, so it speaks serif (law 2). */}
      <p data-evidence className="font-serif text-lg leading-snug text-ink">
        {node.label}
      </p>

      {data.sender != null && (
        <DetailRow label="From">{data.sender}</DetailRow>
      )}

      {data.receivedAt != null && (
        <DetailRow label="Received">{data.receivedAt}</DetailRow>
      )}

      <div>
        <Link href={`/emails/${node.id}`} className={DETAIL_LINK}>
          Open editor &rarr;
        </Link>
      </div>
    </div>
  );
}

function KnowledgeNodeContent({ node }: { readonly node: SelectedNode }): React.ReactElement {
  const data = node as unknown as KnowledgeNodeData;

  // Build the KnowledgeNode shape for consistency with entity-knowledge.tsx structure
  const kn: KnowledgeNode = {
    id: node.id,
    title: node.label,
    content: typeof data.content === "string" ? data.content : null,
    source: typeof data.source === "string" ? data.source : null,
    confidence: typeof data.confidence === "number" ? data.confidence : null,
    createdAt:
      typeof data.createdAt === "string"
        ? new Date(data.createdAt)
        : null,
  };

  return (
    <div className="space-y-4">
      <Badge
        variant="secondary"
        className="bg-primary/10 text-primary border-primary/30"
      >
        Knowledge Rule
      </Badge>

      {/* Body text — plain escaped React text (T-11-05: no dangerouslySetInnerHTML) */}
      {kn.content != null && (
        <p className="text-sm text-muted-foreground">{kn.content}</p>
      )}

      {kn.source != null && (
        <DetailRow label="Source">
          <Badge variant="secondary" className="text-xs">{kn.source}</Badge>
        </DetailRow>
      )}

      {kn.confidence != null && (
        <DetailRow label="Confidence">
          {Math.round(kn.confidence * 100)}% confidence
        </DetailRow>
      )}

      {kn.createdAt != null && (
        <DetailRow label="Created">
          {format(new Date(kn.createdAt), "PP")}
        </DetailRow>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function NodeDetailPane({
  selectedNode,
  onClose,
  onSelectNode,
}: NodeDetailPaneProps): React.ReactElement {
  return (
    <div
      role="complementary"
      aria-label="Node details"
      className="flex h-full w-80 flex-col border-l border-border/50 bg-background/95"
    >
      {selectedNode == null ? (
        /* Default empty state */
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <Share2 className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Click any node to explore it</p>
        </div>
      ) : (
        /* Selected node content */
        <div className="flex h-full flex-col" aria-live="polite">
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{selectedNode.label}</p>
            </div>
            {/* hidden below md (53-06-PLAN.md Task 2, Judgment Call #5):
                inside the mobile Sheet, SheetContent already ships its own
                corner close control — this internal X would be a second,
                redundant close affordance stacked in the same corner. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close detail panel"
              className="size-7 shrink-0 hidden md:inline-flex"
              onClick={onClose}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Separator className="mb-4" />

              {selectedNode.type === "entity_type" && (
                <EntityTypeContent node={selectedNode} />
              )}
              {selectedNode.type === "entity_type_field" && (
                <EntityTypeFieldContent
                  node={selectedNode}
                  onSelectNode={onSelectNode}
                />
              )}
              {selectedNode.type === "entity_instance" && (
                <EntityInstanceContent node={selectedNode} />
              )}
              {selectedNode.type === "email_component" && (
                <EmailComponentContent node={selectedNode} />
              )}
              {selectedNode.type === "email" && (
                <EmailContent node={selectedNode} />
              )}
              {selectedNode.type === "knowledge_node" && (
                <KnowledgeNodeContent node={selectedNode} />
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
