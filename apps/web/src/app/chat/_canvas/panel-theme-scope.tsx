"use client";

/**
 * panel-theme-scope.tsx — PanelThemeScope: app-owned pack + bounded
 * token-override theming wrapper (52-01-PLAN.md Task 2, PANL-01/04).
 *
 * Mirrors `@polytoken/genui/theme`'s `ThemedRoot` (the renderer's OWN
 * alias→CSS-var boundary) but is APP-owned and additionally accepts optional
 * per-panel `tokenOverrides` (PANL-04's NL re-theme resolution output).
 * Resolves `getStylePack(packId).resolvedVars`, merges `tokenOverrides` ON
 * TOP (override wins per-key), and renders a wrapper `div` whose inline
 * style sets every entry as `--{cssVarName}: value` — every shadcn/ui
 * component in `@polytoken/ui` reads `var(--*)` directly (globals.css's
 * tokens are full `oklch(...)` color functions as of 55-02), so this
 * swaps the panel's entire visual theme without any component changes.
 * COLOR-named vars are wrapped in `hsl(...)` below before injection (mirrors
 * `@polytoken/genui/theme`'s `ThemedRoot` fix, 55-02 Task 2) since
 * `pack.resolvedVars`/`tokenOverrides` still carry bare HSL channel triplets
 * (packs.ts stays HSL by design) — an unwrapped triplet is not a valid CSS
 * color once consumers read the var bare.
 *
 * Security/discipline contracts (mirrors ThemedRoot's, T-17-02/T-17-04):
 *   - ZERO eval/new Function/dangerouslySetInnerHTML — values reach the DOM
 *     exclusively via the React `style` prop.
 *   - Unknown `packId` silently resolves to the default pack via
 *     `getStylePack()` (never throws — T-17-04).
 *   - `tokenOverrides` keys are applied VERBATIM as `--{key}`; the allow-list
 *     enforcement (only known TOKEN_ALIASES-mapped CSS var names) lives
 *     upstream in PANL-04's resolution schema — this component trusts its
 *     already-validated input, exactly as ThemedRoot trusts its caller's
 *     validated `packId`.
 *   - ZERO raw hex, ZERO Tailwind palette classes — every value flows from
 *     the pack registry or validated overrides (keeps `palette-ban.test.ts`
 *     + `token-contrast`/`token-registration` gates green).
 */

import * as React from "react";

import { getStylePack, TOKEN_ALIAS_TO_CSS_VAR } from "@polytoken/genui/theme";
import type { StylePackId, TokenAlias } from "@polytoken/genui/theme";

/**
 * The CSS var names (without `--`) whose DTCG alias starts with `color.` —
 * i.e. the subset of `pack.resolvedVars`/`tokenOverrides` entries that are
 * actual colors and therefore need the `hsl(...)` wrapper below. Derived
 * from `TOKEN_ALIAS_TO_CSS_VAR` (mirrors `ThemedRoot`'s identical
 * derivation, 55-02 Task 2) rather than hand-maintained, so this set never
 * drifts from the token contract.
 */
const COLOR_CSS_VAR_NAMES: ReadonlySet<string> = new Set(
  (Object.entries(TOKEN_ALIAS_TO_CSS_VAR) as ReadonlyArray<[TokenAlias, string]>)
    .filter(([alias]) => alias.startsWith("color."))
    .map(([, cssVarName]) => cssVarName),
);

/** Wraps color-group values in `hsl(...)` (packs.ts stays bare-HSL by
 * design); non-color values (radius/spacing/shadow/typography) pass through
 * raw. */
function resolveVarValue(varName: string, value: string): string {
  return COLOR_CSS_VAR_NAMES.has(varName) ? `hsl(${value})` : value;
}

export interface PanelThemeScopeProps {
  /**
   * The style pack id to resolve. Unknown ids silently fall back to the
   * default pack (polytoken-teal) via getStylePack() — T-17-04.
   */
  readonly packId: StylePackId | string;
  /** Bounded per-panel token overrides (PANL-04) — cssVarName-without-`--`
   * -> value. Applied ON TOP of the pack's own resolvedVars (override wins). */
  readonly tokenOverrides?: Record<string, string>;
  readonly children: React.ReactNode;
}

/**
 * PanelThemeScope — pack + bounded-override CSS-variable boundary for a
 * single editable canvas panel.
 */
export function PanelThemeScope({
  packId,
  tokenOverrides,
  children,
}: PanelThemeScopeProps): React.ReactElement {
  // getStylePack always returns a valid pack — never throws (T-17-04).
  const pack = getStylePack(packId as StylePackId);

  const cssVarStyle: Record<string, string> = {};
  for (const [varName, value] of Object.entries(pack.resolvedVars)) {
    cssVarStyle[`--${varName}`] = resolveVarValue(varName, value);
  }
  for (const [varName, value] of Object.entries(tokenOverrides ?? {})) {
    cssVarStyle[`--${varName}`] = resolveVarValue(varName, value);
  }

  return (
    <div className="h-full min-h-0" style={cssVarStyle as React.CSSProperties}>
      {children}
    </div>
  );
}
