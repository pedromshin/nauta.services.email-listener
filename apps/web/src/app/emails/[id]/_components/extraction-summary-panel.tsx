"use client";

/**
 * extraction-summary-panel.tsx — a read-only, document-wide summary of everything
 * extracted from THIS email: each entity, its type/tier, and its field
 * values. The single place a user can look to know "what did we pull out of this
 * document" — independent of canvas selection and of the /entities gallery
 * (which only shows CONFIRMED entities).
 *
 * Reuses the same `LayersComponent[]` the layers tree consumes, so it needs no
 * extra query.
 *
 * T-60-02 (Tampering/XSS): `candidateValue`/`contentText`/`propertyLabel` all
 * derive from attacker-authored documents. Every one of them renders as a React
 * text node (auto-escaped) — this file must never reach for
 * `dangerouslySetInnerHTML`, and must never interpolate a value into a class or
 * a style. Tier classes are LOOKUPS from `REGION_TIER`, keyed by the `tierOf`
 * union, never strings built by concatenation.
 *
 * T-60-08 (Repudiation): tier resolves through `tierOf` and ONLY `tierOf`. A
 * second, local re-derivation of "is this confirmed?" is how a UI starts
 * claiming confirmations that never happened. The pre-60 tone map this replaces
 * painted a candidate in a node-TYPE hue (60-CONTEXT.md flags it by name) — a
 * type colour standing in for a tier, breaking laws 1 and 3 at once, and
 * post-59 resolving to a flat grey that made a candidate look like a
 * classification rather than a claim awaiting a human.
 *
 * LAW 2, TURNED THE RIGHT WAY UP (60-05-PLAN.md Task 1). Pre-60 the property
 * LABEL was `font-medium` foreground and the extracted VALUE was muted — the
 * document's own words, the entire product, rendered as the least important
 * thing on the row. Inverted here: the label is polytoken's word for a slot, so
 * it is chrome (small, muted, sans); the value is the document's own words, so
 * it is evidence (serif, tabular, in the pmark provenance language tinted by
 * its own tier). An ABSENCE is not evidence, so the "no value" note stays a
 * muted italic sans — it never gets the serif.
 */

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@polytoken/ui/button";
import { ScrollArea } from "@polytoken/ui/scroll-area";

import type { LayersComponent } from "./layers-panel";
import { contentSnippet } from "./region-label";
import { REGION_TIER, tierOf, type RegionTier } from "./region-vocabulary";

interface ExtractionSummaryPanelProps {
  readonly components: readonly LayersComponent[];
  /**
   * Confirm a candidate ENTITY region → promotes it to the /entities gallery
   * (POST /v1/components/{id}/confirm). Without this, an entity can only be
   * "accepted" (→candidate) and never reaches the gallery.
   */
  readonly onConfirmEntity?: (componentId: string) => void;
  /** Entity component ids with a confirm in flight (for the button spinner). */
  readonly confirmingEntityIds?: ReadonlySet<string>;
}

/** Rows we never surface (mirror the layers tree's visible filter). */
const HIDDEN_STATUSES = new Set(["rejected", "superseded"]);

/**
 * A FIELD is worth surfacing in the summary only when it carries an extracted
 * value OR is mapped to a property. Unmapped, value-less drawn boxes (often
 * hundreds of raw-OCR regions) are noise here — they belong in the canvas, not
 * in the "what did we extract" summary. (T-60-09: this filter, not a cap, is
 * the real bound on how much this panel renders.)
 */
function isMeaningfulField(c: LayersComponent): boolean {
  return c.candidateValue !== null || c.entityTypeFieldId !== null;
}

/**
 * The tier, SAID IN A WORD. Pre-60 the word existed only as an `sr-only`
 * label behind a 2x2 dot: the tier was communicated to sighted users by a
 * coloured dot and nothing else — exactly the "tier meter" accessibility
 * concern 58-IDENTITY.md rejected in Direction C.
 *
 * "terminal" is unreachable from this panel today (its only two statuses,
 * rejected and superseded, are precisely HIDDEN_STATUSES) but is required for
 * exhaustiveness over the `tierOf` union — and keeps a future status that maps
 * to terminal from rendering a wordless badge.
 */
const TIER_WORD: Record<RegionTier, string> = {
  confirmed: "Confirmed",
  suggested: "Suggested",
  terminal: "Not in play",
};

/**
 * The tier badge — direction-final.html's `.badge.c`/`.badge.s`: a swatch PLUS
 * the visible word, in the sans (the word is polytoken's, not the document's).
 * Colour and swatch both come from `REGION_TIER`, so this surface cannot drift
 * from the overlay boxes or the inbox chips.
 */
function TierBadge({ status }: { status: string }) {
  const tier = tierOf(status);
  const { badge, swatch } = REGION_TIER[tier];
  return (
    <span
      data-field="tier-badge"
      data-tier={tier}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-2xs font-semibold whitespace-nowrap ${badge}`}
    >
      <span className={`h-[7px] w-[7px] shrink-0 rounded-[1.5px] ${swatch}`} aria-hidden />
      {TIER_WORD[tier]}
    </span>
  );
}

/**
 * The document's own words. Serif + tabular + the pmark mark, tinted by the
 * row's OWN tier — never its parent entity's: a suggested field under a
 * confirmed entity is still only suggested, and inheriting the parent's tint
 * here would be T-60-08's "claiming a confirmation that never happened" in
 * visual form.
 *
 * `tabular` because amounts and dates live here (58-IDENTITY.md: "tabular
 * numerals everywhere"). The tint comes from `chip` alone — no `text-*`
 * colour is stacked on top of it, since two colour utilities on one element
 * resolve by Tailwind's cascade order rather than by intent.
 */
function EvidenceValue({ value, status }: { value: string; status: string }) {
  const tier = tierOf(status);
  return (
    <span
      data-field="value"
      data-evidence
      className={`${REGION_TIER[tier].chip} font-serif tabular text-sm wrap-break-word`}
    >
      {value}
    </span>
  );
}

/**
 * A single field band: the property label OVER its extracted value, ruled with
 * a hairline (direction-final.html's `.kd-rows`) rather than the pre-60
 * `justify-between` label/value/dot row, which gave the label and the value
 * equal billing and hid the tier in a dot.
 */
function FieldRow({ field }: { field: LayersComponent }) {
  const label = field.propertyLabel ?? field.contentText ?? "Unmapped field";
  const value = field.candidateValue;
  return (
    <li data-field="field" className="flex items-start gap-3 border-b border-hair py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p data-field="label" className="truncate text-2xs text-pencil">
          {label}
        </p>
        <p className="mt-1 min-w-0">
          {value !== null && value !== "" ? (
            <EvidenceValue value={value} status={field.extractionStatus} />
          ) : (
            <span className="text-xs italic text-pencil">no value</span>
          )}
        </p>
      </div>
      <TierBadge status={field.extractionStatus} />
    </li>
  );
}

export function ExtractionSummaryPanel({
  components,
  onConfirmEntity,
  confirmingEntityIds,
}: ExtractionSummaryPanelProps) {
  const visible = components.filter(
    (c) => c.sourceType === "region" && !HIDDEN_STATUSES.has(c.extractionStatus),
  );

  const entities = visible.filter((c) => c.role === "entity");

  const meaningfulFields = visible.filter(
    (c) => c.role === "field" && isMeaningfulField(c),
  );

  const fieldsByParent = new Map<string, LayersComponent[]>();
  for (const c of meaningfulFields) {
    if (c.parentComponentId === null) continue;
    const bucket = fieldsByParent.get(c.parentComponentId) ?? [];
    bucket.push(c);
    fieldsByParent.set(c.parentComponentId, bucket);
  }

  // Meaningful fields not nested under any entity (drawn but not yet related).
  const orphanFields = meaningfulFields.filter(
    (c) =>
      c.parentComponentId === null ||
      !entities.some((e) => e.id === c.parentComponentId),
  );

  const isEmpty = entities.length === 0 && orphanFields.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-rule px-3 py-2">
        <h2 className="text-sm font-semibold">Extracted from this document</h2>
        <p className="text-xs text-pencil">
          {entities.length} {entities.length === 1 ? "entity" : "entities"}
          {orphanFields.length > 0
            ? ` · ${orphanFields.length} unlinked field${orphanFields.length === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-3">
          {isEmpty ? (
            <p className="text-sm text-pencil">
              Nothing extracted yet. Draw and classify regions, or run autofill,
              to populate this summary.
            </p>
          ) : null}

          {entities.map((entity) => {
            const fields = fieldsByParent.get(entity.id) ?? [];
            // The entity's OWN detected words. The pre-60 header named the type
            // and stopped there — it could tell you "Supplier" but never WHICH
            // supplier, which is the one thing a "what did we pull out of this
            // document" registry exists to answer. Evidence, so it renders in
            // the same mark language as a field value.
            const detected = contentSnippet(entity.contentText);
            const isConfirmed = tierOf(entity.extractionStatus) === "confirmed";
            const isConfirming = confirmingEntityIds?.has(entity.id) ?? false;
            return (
              // The section is a FRAME — chrome — so it takes the rule/leaf
              // treatment, NOT a tier tint: tinting a whole section by tier
              // would flood the panel with wash and drown the individual field
              // marks. The entity's tier colours its badge instead.
              <section
                key={entity.id}
                data-field="entity"
                className="rounded-card border border-rule bg-leaf"
              >
                <header className="flex items-start justify-between gap-2 border-b border-hair px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p data-field="entity-type" className="truncate text-sm font-semibold">
                      {entity.entityTypeLabel ?? "Unclassified entity"}
                    </p>
                    {detected !== null ? (
                      <p className="mt-1 min-w-0 truncate">
                        <EvidenceValue value={detected} status={entity.extractionStatus} />
                      </p>
                    ) : null}
                  </div>
                  <TierBadge status={entity.extractionStatus} />
                </header>
                {isConfirmed ? (
                  <p className="flex items-center gap-1.5 px-3 pt-2 text-xs font-medium text-conf">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    In the entities gallery
                  </p>
                ) : onConfirmEntity ? (
                  <div className="px-3 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-full text-xs"
                      disabled={isConfirming}
                      onClick={() => onConfirmEntity(entity.id)}
                    >
                      {isConfirming ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Confirm → add to gallery
                    </Button>
                  </div>
                ) : null}
                {fields.length > 0 ? (
                  <ul className="px-3 py-1">
                    {fields.map((field) => (
                      <FieldRow key={field.id} field={field} />
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-xs italic text-pencil">
                    No fields extracted for this entity yet.
                  </p>
                )}
              </section>
            );
          })}

          {orphanFields.length > 0 ? (
            <section data-field="orphans" className="rounded-card border border-rule bg-leaf">
              <header className="border-b border-hair px-3 py-2">
                <p className="text-sm font-semibold text-pencil">Unlinked fields</p>
              </header>
              <ul className="px-3 py-1">
                {orphanFields.map((field) => (
                  <FieldRow key={field.id} field={field} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
