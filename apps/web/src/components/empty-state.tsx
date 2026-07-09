"use client";

/**
 * empty-state.tsx — shared EmptyState primitive (FIX-11, 26-UI-SPEC.md § "FIX-11").
 *
 * Collapses ChatHomeEmptyState/CanvasEmptyState/UnknownNodeTypePlaceholder's three
 * near-identical icon+heading+body recipes into ONE primitive driven by explicit
 * layout/tone/size/action/caption variant props. Cross-route: lives alongside
 * app-sidebar.tsx/theme-provider.tsx (this directory's existing cross-cutting-
 * component convention) — NOT in packages/ui, since this is an app-local
 * presentational primitive, not a design-system component.
 *
 * De-duplication refactor, not a redesign: each call site's variant configuration
 * reproduces its PRIOR rendering pixel-for-pixel — see chat-home-empty-state.tsx /
 * canvas-empty-state.tsx / unknown-node-type-placeholder.tsx for the call sites
 * this primitive replaces the bespoke JSX bodies of.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@polytoken/ui/button";

export interface EmptyStateAction {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

export interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly heading: string;
  /**
   * Supporting sentence rendered below the heading. Not rendered for
   * layout="inline" — that variant's only current call site
   * (UnknownNodeTypePlaceholder) has no secondary body line, just a heading
   * row plus an optional caption. Still required (not optional) so every
   * call site stays explicit about having no body copy rather than silently
   * omitting one.
   */
  readonly body: string;
  /**
   * "centered" (default): full-pane vertical center. "inline": compact
   * icon+text row that centers only within its own bounded container — never
   * against the viewport (used inside a React Flow node card).
   */
  readonly layout?: "centered" | "inline";
  /** Icon tint. Default "muted". */
  readonly tone?: "muted" | "destructive";
  /** Icon size + heading register. Default "compact". */
  readonly size?: "compact" | "spacious";
  readonly action?: EmptyStateAction;
  /** Small caption line below body (or below the inline row) — e.g. unknown-node-type's "Type: {x}" line. */
  readonly caption?: string;
}

function iconToneClass(
  tone: "muted" | "destructive",
  size: "compact" | "spacious",
): string {
  if (tone === "destructive") return "text-destructive";
  return size === "spacious" ? "text-muted-foreground/40" : "text-muted-foreground";
}

function iconSizeClass(
  layout: "centered" | "inline",
  size: "compact" | "spacious",
): string {
  if (layout === "inline") return "size-4";
  return size === "spacious" ? "size-10" : "size-8";
}

function ActionButton({
  action,
}: {
  readonly action: EmptyStateAction | undefined;
}): React.ReactElement | null {
  if (!action) return null;
  const ActionIcon = action.icon;
  return (
    <Button
      type="button"
      variant="default"
      className="mt-6 gap-2"
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {ActionIcon ? <ActionIcon className="size-4" aria-hidden /> : null}
      {action.label}
    </Button>
  );
}

/**
 * EmptyState — shared icon+heading+body(+action)(+caption) primitive. See
 * EmptyStateProps for the five variant dimensions (FIX-11).
 */
export function EmptyState({
  icon: Icon,
  heading,
  body,
  layout = "centered",
  tone = "muted",
  size = "compact",
  action,
  caption,
}: EmptyStateProps): React.ReactElement {
  if (layout === "inline") {
    return (
      <>
        <div className="flex items-center gap-2">
          <Icon
            className={`${iconSizeClass(layout, size)} shrink-0 ${iconToneClass(tone, size)}`}
            aria-hidden
          />
          <span className="text-sm font-normal text-foreground">{heading}</span>
        </div>
        {caption ? (
          <p className="text-xs text-muted-foreground">{caption}</p>
        ) : null}
        <ActionButton action={action} />
      </>
    );
  }

  if (size === "spacious") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-24 text-center">
        <Icon
          className={`mb-4 ${iconSizeClass(layout, size)} ${iconToneClass(tone, size)}`}
          aria-hidden
        />
        <h1 className="text-2xl font-semibold text-foreground">{heading}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
        <ActionButton action={action} />
        {caption ? (
          <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon
        className={`${iconSizeClass(layout, size)} ${iconToneClass(tone, size)}`}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="text-base font-semibold">{heading}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      <ActionButton action={action} />
      {caption ? (
        <p className="text-xs text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}
