"use client";

// Explicit React import — this file's JSX compiles fine under Next.js's SWC
// automatic JSX runtime, but vitest's plain esbuild transform defaults to
// the classic runtime (React.createElement) and needs `React` in scope
// whenever a test mounts this component directly (mirrors
// genui-panel-node.tsx's identical note — found live, 53-03-PLAN.md Task 1,
// inbox-mobile-stack.test.tsx).
import * as React from "react";
import Link from "next/link";

import type { EntityChipEntry } from "./entity-chips";

interface InboxEntitiesRailProps {
  /**
   * The SELECTED email's already-resolved facts. No new query — the caller
   * (InboxThreePane) already holds the single batched `entitySummary`
   * result; this is `entitiesByEmailId.get(selectedEmailId) ?? []` (T-60-06
   * — the rail must never widen the lookup beyond what was already fetched
   * for the selected email).
   */
  readonly entities: ReadonlyArray<EntityChipEntry>;
  readonly emailId: string;
}

/**
 * InboxEntitiesRail (D-58-01, 60-03-PLAN.md Task 2) — the fourth pane:
 * "What I found in this email." A fixed-width aside, not a resizable panel
 * (the reference's `.entities` is fixed at 288px; a resizable fourth panel
 * would renegotiate all three existing desktop ResizablePanel sizes for no
 * design gain).
 *
 * Renders each fact as the SAME provenance-mark language `EntityChips` uses
 * on the row (`pmark`/`pmark-confirmed`/`pmark-suggested`) — one mark
 * language across both inbox surfaces is the whole point of a signature
 * element. Under law 3 the tier BADGE is the one thing that earns colour;
 * the type word underneath carries no hue and no entity-type-as-silhouette
 * glyph (the reference's own "Chanel rule" — the word already says the
 * type, so a shape beside it would only repeat it, and "date" has no shape
 * of its own to borrow honestly).
 *
 * SCOPE CALL: the reference's `.ent-actions` Confirm/Dismiss buttons are
 * NOT built here. Confirm/deny is an existing, canonical capability
 * (`ConfirmDenyControls`, the `components/{id}/confirm` mutation) that
 * lives on `/emails/[id]` — the surface designed for it. Adding a second
 * mutation path in the inbox would be new product behaviour, not a
 * redesign of an existing interaction, and neither D-58-01 nor the ROADMAP
 * criteria ask for it. Instead, a suggested fact links onward to the
 * detail view where the real control lives.
 *
 * Hidden below `xl` (1280px, the nearest registered breakpoint to the
 * reference's 1120px guard — see 60-03-SUMMARY.md for why a custom
 * breakpoint was deliberately not added for one rail). Renders `null` for
 * an empty entity list — the reference has no empty-rail state, and a
 * heading over nothing is noise.
 */
export function InboxEntitiesRail({
  entities,
  emailId,
}: InboxEntitiesRailProps): React.ReactElement | null {
  if (entities.length === 0) return null;

  return (
    <aside
      data-pane="entities"
      aria-label="What I found in this email"
      className="hidden w-72 shrink-0 flex-col border-l border-hair bg-leaf p-panel xl:flex"
    >
      <h3 className="mb-3.5 text-sm font-semibold text-ink">
        What I found in this email
      </h3>

      <div className="flex-1">
        {entities.map((entity) => {
          const isConfirmed = entity.tier === "confirmed";
          const tierClass = isConfirmed ? "pmark-confirmed" : "pmark-suggested";
          const value = entity.value ?? entity.typeLabel;

          return (
            <div
              key={entity.componentId}
              data-field="fact"
              className="border-b border-hair py-2.5 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span
                  data-evidence
                  className={`pmark ${tierClass} min-w-0 flex-1 truncate font-serif text-sm tabular`}
                >
                  {value}
                </span>
                {/* The tier BADGE — law 3: this is the one thing on the
                    row that earns colour. Ported from the reference's
                    `.badge.c`/`.badge.s` (a filled swatch for confirmed, a
                    dashed-outline swatch for suggested — the same
                    solid-vs-dashed language the mark itself carries). */}
                <span
                  data-field="tier-badge"
                  data-tier={entity.tier}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs leading-none font-semibold whitespace-nowrap ${
                    isConfirmed
                      ? "border border-conf-line bg-conf-wash text-conf"
                      : "border border-dashed border-sugg-line bg-sugg-wash text-sugg"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`block size-[7px] rounded-[1.5px] ${
                      isConfirmed ? "bg-conf" : "border border-dashed border-sugg"
                    }`}
                  />
                  {isConfirmed ? "Confirmed" : "Suggested"}
                </span>
              </div>

              {/* CHANEL RULE (direction-final.html lines 44-50/382-387):
                  no entity-type-as-silhouette glyph here — the type WORD
                  is already right beside it, and "date" has no shape of
                  its own to borrow honestly. */}
              <div className="mt-1 text-2xs text-pencil">{entity.typeLabel}</div>

              {!isConfirmed && (
                <Link
                  href={`/emails/${emailId}`}
                  className="mt-1.5 inline-block text-xs font-semibold text-ink underline underline-offset-2"
                >
                  Review in email →
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <Link
        href="/knowledge"
        className="mt-auto block pt-4 text-xs font-semibold text-ink underline underline-offset-2"
      >
        See it all in your knowledge →
      </Link>
    </aside>
  );
}
