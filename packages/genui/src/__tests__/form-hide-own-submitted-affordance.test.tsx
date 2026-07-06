/**
 * __tests__/form-hide-own-submitted-affordance.test.tsx — 24-05 fix pass (24-UI-REVIEW.md
 * Top Priority Fix #1): proves `hideOwnSubmittedAffordance` suppresses FormComponent's own
 * "Submitted ✓" text when the form is rendered inside a host chrome (InteractiveWidgetBoundary)
 * that owns the submitted/submitting signal, WITHOUT touching the Phase-19 studio path (the
 * flag defaults to unset/false, preserving "Submitted ✓" for every existing spec).
 *
 * Exercises the REAL production path end-to-end: a SpecRootSchema-valid form node ->
 * SpecRenderer -> the catalog's FormComponent — no mocks of the renderer, schema, or catalog
 * (mirrors form-submit-values.test.tsx's convention).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SpecRenderer } from "../renderer/spec-renderer";
import type { ActionRegistry } from "../renderer/action-registry-context";
import type { SpecRoot } from "../schema/spec-schema";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildFormSpec(formProps: Record<string, unknown>): SpecRoot {
  return {
    v: 1,
    root: { type: "form", ...formProps },
  } as unknown as SpecRoot;
}

async function mountSpec(
  spec: SpecRoot,
  actions?: ActionRegistry,
): Promise<{ container: HTMLDivElement; cleanup: () => void }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(SpecRenderer, { spec, actions }));
  });

  return {
    container,
    cleanup: () => {
      root.unmount();
      document.body.removeChild(container);
    },
  };
}

const ONE_FIELD_FORM = {
  fields: [{ name: "fieldA", label: "Field A" }],
  onSubmit: { type: "setState", key: "clarify.submit", value: null },
};

describe("FormComponent hideOwnSubmittedAffordance (24-05, 24-UI-REVIEW Top Fix #1)", () => {
  it("default (unset) — a successful submit still shows 'Submitted ✓' (Phase-19 studio path unaffected)", async () => {
    const spec = buildFormSpec(ONE_FIELD_FORM);
    const { container, cleanup } = await mountSpec(spec, { setState: () => {} });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
    });

    expect(container.textContent).toContain("Submitted ✓");
    cleanup();
  });

  it("hideOwnSubmittedAffordance: true — a successful submit never renders 'Submitted ✓'", async () => {
    const spec = buildFormSpec({ ...ONE_FIELD_FORM, hideOwnSubmittedAffordance: true });
    const { container, cleanup } = await mountSpec(spec, { setState: () => {} });

    const form = container.querySelector("form") as HTMLFormElement;
    await act(async () => {
      form.requestSubmit();
    });

    expect(container.textContent).not.toContain("Submitted ✓");
    cleanup();
  });
});
