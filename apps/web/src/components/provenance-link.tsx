"use client";

/**
 * provenance-link.tsx — ProvenanceLink (TUI-02, 39-UI-SPEC.md's
 * "<ProvenanceLink>" section). The ONE shared citation-chip primitive:
 * consumed by ToolInvocationResultRow's citation chips this phase, and by
 * Phase 41's knowledge-preview canvas node later (decided once, used twice —
 * 39-CONTEXT.md).
 *
 * Route computed internally, NEVER trusted from a caller-supplied string —
 * `hrefFor` is a fixed 3-way switch, mirroring `use-data-bindings.ts`'s
 * (Phase 33) "compile-time switch, never model-authored" discipline applied
 * to route selection (T-39-05). A citation's own `route` field (if any) is
 * never passed to this component or to `<Link href>`.
 *
 * ════════════════════════════════════════════════════════════════════════
 * LAW 2 LIVES HERE (D-58-01, 61-04). THIS IS THE HARD CASE.
 * ════════════════════════════════════════════════════════════════════════
 *
 * "Chrome speaks sans, evidence speaks serif. Anything from the user's own
 * mail/content is serif. No exceptions." A citation chip is the ONE place an
 * email's real subject enters a chat answer — so it is where that rule either
 * becomes real on this surface or quietly does not.
 *
 * The defect this file used to have was STRUCTURAL, not cosmetic:
 *
 *     {label ?? fallbackLabel(kind, id)}
 *
 * That single expression collapses two completely different PROVENANCES into
 * one string — an email's real subject ("Cotação frete SP → POA — Lote 88",
 * the user's own material, evidence) and polytoken's own placeholder
 * ("Email · 1a2b3c4d", our vocabulary, chrome). Once collapsed, no styling
 * decision downstream can tell them apart, so the component was structurally
 * UNABLE to obey law 2 regardless of what classes it wore.
 *
 * That is the identical shape `regionLabelFor` (region-vocabulary.ts:211) was
 * written to fix one surface over, where `entityTypeLabel ?? contentSnippet()
 * ?? status` collapsed three provenances the same way. The fix is the same
 * shape too — discriminate, then style the BRANCH — and it is deliberately not
 * a new invention (brand-guide.md §3 "Law 2 in practice").
 *
 * ── The `pmark`-vs-compose decision, recorded (D-61-04-B) ──
 *
 * This chip COMPOSES `border`/`bg` directly and applies `font-serif` only to
 * the evidence span. It does NOT use the `pmark` utility. Four reasons, and
 * the first is the one that matters:
 *
 *  1. `pmark` IMPLIES `font-serif` (globals.css:419 sets `font-family:
 *     var(--font-serif)`). On this chip that would put serif on the CONTAINER
 *     — and therefore on the icon and on the fallback label, which are chrome.
 *     No className-reading gate can catch that, because the violation is an
 *     INHERITED property, not a class (60-05's finding, re-hit by 60-06).
 *     The sketch agrees: `.srcchip` sets no font, and puts the serif on the
 *     inner `.st` span alone (direction-final.html:428).
 *  2. `pmark` is the TIER mark; its colour comes from `pmark-confirmed` /
 *     `pmark-suggested`. A citation chip makes NO tier claim — it is
 *     neutral-palette by design — so bare `pmark` would be a tier mark with no
 *     tier, and a tier variant would be a claim we have not earned.
 *  3. brand-guide §3's export discipline says it outright: "`.chip` looks like
 *     the obvious 'tier colour' export. It is not. It is the *evidence*
 *     export." This container is not evidence; only its evidence branch's text
 *     is.
 *  4. The geometry differs anyway — `pmark` is 3px/`0 0.22em`, `.srcchip` is
 *     4px/`5px 9px`.
 *
 * The container still states `font-sans` EXPLICITLY rather than inheriting it.
 * This is a shared primitive: a future consumer may render it inside a
 * `pmark`'d context, and then the chrome branch would silently inherit serif.
 * Stating the cancel makes the chrome branch sans by declaration instead of by
 * luck, and mirrors the canonical chip's own shape (entity-chips.tsx).
 */

import * as React from "react";
import Link from "next/link";
import { Box, Mail, Share2 } from "lucide-react";

export type ProvenanceKind = "email" | "entity" | "knowledge";

export interface ProvenanceLinkProps {
  readonly kind: ProvenanceKind;
  readonly id: string;
  readonly label?: string;
}

const ICON_BY_KIND: Readonly<Record<ProvenanceKind, typeof Mail>> = {
  email: Mail,
  entity: Box,
  knowledge: Share2,
};

/**
 * The sketch's `.srcchip` (direction-final.html:423) — `--leaf` fill, `--rule`
 * border, `--shade`/`--rule-hi` hover, `--faded` icon, 12px text. The same
 * mark family as the inbox's chip: one mark language everywhere.
 *
 * It shipped as a `rounded-pill bg-muted` chip with `hover:bg-accent` and a
 * `focus-visible:ring` — a pill reads as a BUTTON, and this is a link to a
 * document.
 *
 * `px-chip-x py-chip-y` (7px/4px) is the NAMED chip step rather than
 * `.srcchip`'s literal 9px/5px. Deliberate: brand-guide §3 asks for one mark
 * language across inbox chips, region chips and citation chips, and the named
 * step is what the other two already spend. 2px of sketch fidelity is a
 * cheaper thing to lose than a shared rhythm.
 *
 * FOCUS IS AN INK OUTLINE, NOT A RING (D-61-03-F, inherited): `--tw-ring-
 * offset-color` defaults to `#fff`, so a ring-offset paints a 1px WHITE halo
 * in dark mode. `outline-solid` is stated because `outline-none` (which this
 * class list no longer carries) is in the outline-STYLE group while `outline-2`
 * is outline-WIDTH — they do NOT evict each other, and the style token also
 * poisons the variable the width token reads. Stating the style is what makes
 * the outline actually render.
 */
const CHIP_CLASS_NAME =
  "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-sm border border-rule bg-leaf px-chip-x py-chip-y font-sans text-xs text-ink transition-colors hover:bg-shade hover:border-(--rule-hi) focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";

/**
 * hrefFor — the fixed kind+id -> path switch, encodeURIComponent-wrapped.
 * Exported so a future consumer (Phase 41) can reuse it without re-deriving
 * the routing table, and so this task's tests can exercise it directly.
 *
 * T-61-12 — IT TAKES `kind` AND `id`, NEVER `label`, AND THAT IS NOW LOAD-
 * BEARING TWICE OVER. Since 61-04 the typography on this chip makes a
 * PROVENANCE CLAIM ("these are your mail's own words"). If the href could be
 * steered by the label, a crafted subject could aim the chip somewhere else
 * while wearing the serif that vouches for it. The claim and the destination
 * must derive from the same narrowed, server-built pair.
 */
export function hrefFor(kind: ProvenanceKind, id: string): string {
  switch (kind) {
    case "email":
      return `/emails/${encodeURIComponent(id)}`;
    case "entity":
      return `/entities/${encodeURIComponent(id)}`;
    case "knowledge":
      return `/knowledge?focus=${encodeURIComponent(id)}`;
  }
}

/**
 * fallbackLabel — the label shown when the caller passes no explicit
 * `label` (the expected case for Phase 36/37's `ToolCitation(kind, id,
 * route)`, which carries no label field): "{Capitalized kind} · {first 8
 * chars of id}", e.g. "Email · a3f21b8e".
 *
 * Behaviour unchanged by 61-04 — what changed is that its output is now
 * CLASSIFIED as chrome rather than blended into the same string as a real
 * subject. This is polytoken's own vocabulary for "a thing we can link to but
 * cannot name", so law 2 gives it sans.
 */
export function fallbackLabel(kind: ProvenanceKind, id: string): string {
  const capitalizedKind = kind.charAt(0).toUpperCase() + kind.slice(1);
  return `${capitalizedKind} · ${id.slice(0, 8)}`;
}

/**
 * ChipLabel — the discriminated provenance of the text this chip renders.
 * The closed union IS the law-2 mechanism: the treatment is selected by the
 * BRANCH, never by looking at what the text says (T-61-11).
 */
export type ChipLabel =
  | { readonly kind: "evidence"; readonly text: string }
  | { readonly kind: "chrome"; readonly text: string };

/**
 * chipLabelFor — `label ?? fallbackLabel(kind, id)`'s exact precedence, now
 * discriminated by PROVENANCE instead of collapsed into one string:
 *
 *   "evidence" — the caller handed us the document's own words (an email's
 *                real subject). The user's material -> serif + data-evidence.
 *   "chrome"   — no label reached us, so we are naming the thing ourselves.
 *                polytoken's vocabulary -> sans, no data-evidence.
 *
 * THE BLANK CHECK IS SAFE, AND THE DIRECTION IS THE REASON (T-61-11/T-61-12).
 * Trimming looks like "inspecting the label's content", which the threat model
 * forbids as a basis for the serif-vs-sans choice. It is not the same thing:
 * this asks only whether a label was SUPPLIED AT ALL, and it can only ever
 * DEMOTE evidence -> chrome, never promote chrome -> evidence. A hostile
 * subject therefore cannot use it to obtain the provenance claim — the worst
 * it can do to itself is decline one. `label ?? ...` alone would render a
 * whitespace-only subject as an empty chip wearing `data-evidence`: a
 * provenance claim over nothing.
 */
export function chipLabelFor(
  kind: ProvenanceKind,
  id: string,
  label?: string,
): ChipLabel {
  if (label !== undefined && label.trim().length > 0) {
    return { kind: "evidence", text: label };
  }
  return { kind: "chrome", text: fallbackLabel(kind, id) };
}

/**
 * ProvenanceLink — a real Next <Link> (never onClick-only) rendering the
 * sketch's `.srcchip`: a per-kind icon plus a truncating label whose
 * TYPOGRAPHY IS DECIDED BY WHERE ITS WORDS CAME FROM.
 *
 * Same component, same props, opposite treatment:
 *   <ProvenanceLink kind="email" id="1a2b…" label="Cotação frete SP → POA" />
 *       -> serif + data-evidence. The mail's own words.
 *   <ProvenanceLink kind="email" id="1a2b…" />
 *       -> sans, no data-evidence. Our placeholder for it.
 *
 * `font-serif` and `data-evidence` are applied as a PAIR, always — the gates
 * enforce the mutual implication, so marking one without the other is a test
 * failure rather than a style nit (brand-guide §3). `tabular` rides with the
 * evidence branch because a subject routinely carries numbers (invoice ids,
 * lot numbers, amounts) and lining/tabular figures are law 2's other half.
 *
 * T-61-11: `text` is tool-envelope-derived (a subject from a hostile
 * document). It stays a React text node inside a <span> and is never
 * interpolated into a class string or a `style`.
 */
export function ProvenanceLink({
  kind,
  id,
  label,
}: ProvenanceLinkProps): React.ReactElement {
  const Icon = ICON_BY_KIND[kind];
  const chipLabel = chipLabelFor(kind, id, label);
  const isEvidence = chipLabel.kind === "evidence";
  return (
    <Link
      href={hrefFor(kind, id)}
      onClick={(event) => event.stopPropagation()}
      className={CHIP_CLASS_NAME}
    >
      {/* Chrome, always — this is our icon for a kind, not the document's
          mark. `--faded`, per `.srcchip svg` (direction-final.html:427). */}
      <Icon className="size-3.5 shrink-0 text-faded" aria-hidden />
      <span
        // THE PAIR. Both, or neither — never one.
        {...(isEvidence ? { "data-evidence": true } : {})}
        className={
          isEvidence
            ? "min-w-0 truncate font-serif tabular"
            : "min-w-0 truncate"
        }
      >
        {chipLabel.text}
      </span>
    </Link>
  );
}
