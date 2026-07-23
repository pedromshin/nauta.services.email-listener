/**
 * inspector-confirm-correction.test.tsx — UI-2 regression gate.
 *
 * The "Candidate value" input in the Inspector used to be an UNCONTROLLED
 * `<Input defaultValue={...}>` with no onChange, and Confirm Field called
 * `onConfirmField(id)` with no value — so a user who corrected the machine's
 * read (e.g. "R$ 4.820,00" → "R$ 4.320,00") had their edit silently discarded
 * and the wrong machine value was stamped "confirmed" and fed to the flywheel.
 *
 * This gate mounts the CandidateValueEditor (the controlled input + Confirm
 * button that the Inspector renders for a candidate FIELD), edits the value,
 * and asserts the edited value is threaded into confirm as keyed
 * corrected_fields — and that an UNEDITED confirm still sends null (no spurious
 * correction).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CandidateValueEditor } from "../inspector-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FIELD_KEY = "total_amount";

function renderEditor(
  props: React.ComponentProps<typeof CandidateValueEditor>,
): { container: HTMLElement; cleanup: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CandidateValueEditor {...props} />);
  });
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function setInputValue(input: HTMLInputElement, next: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickConfirm(container: HTMLElement): void {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "Confirm Field",
  );
  if (!button) throw new Error("Confirm Field button not found");
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("CandidateValueEditor — Confirm carries the user's correction (UI-2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sends the EDITED value as keyed corrected_fields", () => {
    const onConfirm = vi.fn();
    const { container, cleanup } = renderEditor({
      candidateValue: "R$ 4.820,00",
      candidateFieldKey: FIELD_KEY,
      confidenceScore: 0.9,
      lowConfidence: false,
      onConfirm,
    });

    const input = container.querySelector(
      'input[aria-label="Candidate value"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    // The input must be CONTROLLED — it reflects the candidate value.
    expect(input!.value).toBe("R$ 4.820,00");

    setInputValue(input!, "R$ 4.320,00");
    clickConfirm(container);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ [FIELD_KEY]: "R$ 4.320,00" });

    cleanup();
  });

  it("sends null corrected_fields when the value is left unchanged", () => {
    const onConfirm = vi.fn();
    const { container, cleanup } = renderEditor({
      candidateValue: "R$ 4.820,00",
      candidateFieldKey: FIELD_KEY,
      confidenceScore: 0.9,
      lowConfidence: false,
      onConfirm,
    });

    clickConfirm(container);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(null);

    cleanup();
  });

  it("confirms the machine value as-is when no addressable field key exists", () => {
    const onConfirm = vi.fn();
    const { container, cleanup } = renderEditor({
      candidateValue: "R$ 4.820,00",
      candidateFieldKey: null,
      confidenceScore: null,
      lowConfidence: false,
      onConfirm,
    });

    const input = container.querySelector(
      'input[aria-label="Candidate value"]',
    ) as HTMLInputElement;
    setInputValue(input, "edited but unkeyable");
    clickConfirm(container);

    // Edited, but there is no key to address the correction → confirm as-is.
    expect(onConfirm).toHaveBeenCalledWith(null);

    cleanup();
  });
});
