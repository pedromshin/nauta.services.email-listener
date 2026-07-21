"use client";

/**
 * capability-confirm-card.tsx — the chat-side confirm affordance for a risky
 * capability invocation (INV-4: risk is DATA, not code).
 *
 * The gate itself lives in ONE place — `requiresConfirm` from
 * `@polytoken/genui/binding` (risk-gate.ts): read never confirms, write/exec
 * always do. This card is a CONSUMER of that predicate, never a second copy
 * of the rule: a `read` invocation renders nothing at all, so a read-tier
 * capability can never grow a confirm dialog by accident, and a non-read one
 * can never lose it.
 *
 * Design law applied (58-IDENTITY + taste-references §2.2):
 *   - The risk tier is stated by the ONE semantic risk vocabulary
 *     (`RISK_TIER`, capabilities/_lib/capability-vocabulary.ts) — the same
 *     swatch-dot + label grammar the capabilities surface already taught.
 *     The tier swatch is the only hue on the card body: risk is exactly the
 *     axis the identity's earned hues were built to state.
 *   - Colour earned: the accent is allowed here BECAUSE this is the
 *     irreversible-action scope — the confirm affordance and madder share
 *     exactly one scope (taste-references §2.2). Concretely: only the `exec`
 *     tier's approve control wears the madder FILL (`variant="destructive"`,
 *     the allowed destructive-button form). A `write` approve stays ink —
 *     madder means "this cannot be undone", and painting it on the merely
 *     cautionary tier would teach the colour a second meaning. Madder never
 *     appears as text ink or as a frame here (that would be a state talking).
 *   - Machine-suggested framing: until the human approves, the card wears
 *     the suggested register — DASHED border geometry, the same
 *     accountable-vs-not grammar as the trust badges and the provenance
 *     mark's dashed tier. It is chrome, so it uses `border-rule` + sans (the
 *     `pmark` classes are for evidence and imply serif — never on chrome).
 *     On approve the frame turns solid: a human is now accountable for it.
 *
 * Wiring seam: the genui binding invoker (`BoundCapability.requiresConfirm`,
 * bind-capability.ts) is another wave's file — the consumer that mounts this
 * card and passes `onConfirm` (the actual invoke) plugs in there.
 */

import * as React from "react";

import type { CapabilityManifestEntry } from "@polytoken/capabilities";
import { requiresConfirm } from "@polytoken/genui/binding";
import { cn } from "@polytoken/ui";
import { Button } from "@polytoken/ui/button";

import { RISK_TIER } from "~/app/capabilities/_lib/capability-vocabulary";

export interface CapabilityConfirmCardProps {
  /** The manifest projection of the capability the agent wants to invoke —
   * `id`/`describe`/`risk` are what a human needs to decide (INV-1's
   * "registry pointed outward" shape; nothing here can execute). */
  readonly entry: CapabilityManifestEntry;
  /** Executes the invocation. Called AT MOST ONCE, and only from an explicit
   * human approve — never on render, never after a dismiss. */
  readonly onConfirm: () => void | Promise<void>;
  /** Withdraws the suggestion. Never accompanied by `onConfirm`. */
  readonly onDismiss: () => void;
}

type Decision = "approved" | "dismissed";

export function CapabilityConfirmCard({
  entry,
  onConfirm,
  onDismiss,
}: CapabilityConfirmCardProps): React.ReactElement | null {
  const [decision, setDecision] = React.useState<Decision | null>(null);
  // Ref guard so a double-fire is impossible even if two clicks land before
  // the decided re-render commits — state alone is not a mutex.
  const decidedRef = React.useRef(false);

  const handleApprove = (): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    setDecision("approved");
    void onConfirm();
  };

  const handleDismiss = (): void => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    setDecision("dismissed");
    onDismiss();
  };

  // The ONE gate (risk-gate.ts): a read-tier invocation needs no confirm, so
  // the affordance simply does not exist for it.
  if (!requiresConfirm(entry.risk)) return null;

  // A dismissed suggestion withdraws itself entirely.
  if (decision === "dismissed") return null;

  const tier = RISK_TIER[entry.risk];
  const approved = decision === "approved";

  return (
    <section
      role="group"
      aria-label={`Confirm ${entry.id}`}
      data-state={approved ? "approved" : "suggested"}
      className={cn(
        "my-2 rounded-md border border-rule bg-bright p-panel",
        // Suggested register until a human approves; solid once accountable.
        approved ? "border-solid" : "border-dashed",
      )}
    >
      <p className="text-2xs text-pencil">
        {approved
          ? "Approved — running now."
          : "Agent-suggested action — runs only if you approve."}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* THE one earned hue on this card: the tier's semantic swatch. */}
        <span aria-hidden className={cn("size-2 rounded-full", tier.swatch)} />
        <span className="text-2xs font-semibold uppercase tracking-wide text-ink">
          {tier.label}
        </span>
        <span className="text-sm font-medium text-ink">{entry.id}</span>
      </div>

      <p className="mt-0.5 max-w-[65ch] text-xs leading-relaxed text-faded">{entry.describe}</p>
      <p className="mt-0.5 text-2xs text-pencil">{tier.meaning}</p>

      {!approved && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            // Madder fill ONLY on the irreversible class (exec). Write stays
            // ink — the default variant resolves to `--ink` under law 1.
            variant={entry.risk === "exec" ? "destructive" : "default"}
            onClick={handleApprove}
            aria-label={`Approve ${entry.id}`}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            aria-label={`Dismiss ${entry.id}`}
          >
            Dismiss
          </Button>
        </div>
      )}
    </section>
  );
}
