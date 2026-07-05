/**
 * build-proposal-cards-spec.ts — buildProposalCardsSpec: a deterministic
 * declaration -> SpecRoot builder (Task 2, 24-03, D-05/D-09).
 *
 * Turns a persisted `interactive_widget` (proposal_cards) declaration into a
 * plain catalog spec (stack of card+footer-button nodes) that renders through
 * the UNMODIFIED `SpecRenderer` — no new catalog component, no schema change.
 * Each card's footer button's `onClick` is a `setState` action carrying the
 * clicked option's server-assigned id as its `value` (24-UI-SPEC.md Component
 * Inventory) — `ButtonComponent`'s existing `registry[onClick.type]?.(onClick)`
 * contract (23-06) delivers the FULL onClick object (incl. `value`) to
 * whichever `setState` handler `InteractiveWidgetBoundary` registers.
 *
 * Pure and total: never throws, never mutates its input. The caller
 * (InteractiveWidgetBoundary) re-validates the output against
 * `SpecRootSchema.safeParse` via `GenuiPartBoundary` — the same FOUND-6 gate
 * every other genui part goes through.
 */

import type { SpecRoot } from "@nauta/genui/schema";

/** The `setState` key every proposal-card footer button's `onClick` carries —
 * `InteractiveWidgetBoundary`'s actions registry reads this key's `value` as
 * the clicked option's id. */
export const PROPOSAL_CHOICE_ACTION_KEY = "proposal.choice";

/** Fallback CTA when the declaration supplies no per-option label
 * (24-UI-SPEC.md Copywriting Contract — the only non-agent-authored string
 * this builder ever emits). */
const DEFAULT_OPTION_LABEL = "Choose this option";

export interface ProposalCardOption {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly value?: unknown;
  /** Optional agent-authored per-option CTA verb+noun (e.g. "Ship next
   * week") — falls back to DEFAULT_OPTION_LABEL when absent/empty. Not part
   * of the current 24-02 backend declaration shape, but accepted here so a
   * future declaration can supply it with zero builder changes. */
  readonly label?: string;
}

export interface ProposalCardsDeclaration {
  readonly prompt?: string;
  readonly options: readonly ProposalCardOption[];
}

function optionLabel(option: ProposalCardOption): string {
  return option.label && option.label.length > 0 ? option.label : DEFAULT_OPTION_LABEL;
}

/**
 * buildProposalCardsSpec — declaration -> SpecRoot. Every card is a catalog
 * `card` node (title + optional description, empty `children`) with ONE
 * `button` node in its `footer` slot — the click target (24-UI-SPEC.md
 * Proposal card group layout, D-05). Cards render as a vertical stack
 * (`gap: "sm"`) — correct at both the 768px chat column and the 320px-min
 * canvas panel (D-08).
 */
export function buildProposalCardsSpec(declaration: ProposalCardsDeclaration): SpecRoot {
  const root = {
    type: "stack" as const,
    gap: "sm" as const,
    children: declaration.options.map((option) => {
      const label = optionLabel(option);
      return {
        type: "card" as const,
        title: option.title,
        ...(option.description ? { description: option.description } : {}),
        children: [],
        footer: {
          type: "button" as const,
          label,
          "aria-label": `${label} — ${option.title}`,
          onClick: {
            type: "setState" as const,
            key: PROPOSAL_CHOICE_ACTION_KEY,
            value: option.id,
          },
        },
      };
    }),
  };

  return { v: 1, root } as unknown as SpecRoot;
}

export { DEFAULT_OPTION_LABEL };
