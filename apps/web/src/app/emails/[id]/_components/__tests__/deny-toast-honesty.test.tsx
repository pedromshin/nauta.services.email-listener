/**
 * deny-toast-honesty.test.tsx — UI-1 regression gate.
 *
 * Denying an auto-detected field used to raise a toast with an "Undo" action.
 * It was a lie: no server un-reject endpoint exists, so the action only patched
 * the query cache and immediately re-invalidated (the box reverted to
 * "rejected" on the very next refetch), and deny has a durable side effect (the
 * D-19 denied_field_polygons memo) that no restore ever removed.
 *
 * This gate mounts ConfirmDenyControls, clicks the ✗ deny for an auto-detected
 * box, and asserts the toast carries NO `action` (no fake Undo) — an honest
 * "Field removed." message.
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

import { ConfirmDenyControls } from "../confirm-deny-controls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function render(node: React.ReactElement): {
  container: HTMLElement;
  cleanup: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function clickDeny(container: HTMLElement): void {
  const button = container.querySelector(
    'button[aria-label="Deny field value"]',
  );
  if (!button) throw new Error("Deny button not found");
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("ConfirmDenyControls — deny toast is honest, no fake Undo (UI-1)", () => {
  beforeEach(() => {
    toastInfo.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("auto-detected deny raises a toast with NO Undo action", () => {
    const onDeny = vi.fn();
    const { container, cleanup } = render(
      <ConfirmDenyControls
        componentId="comp-1"
        isAutoDetected={true}
        onConfirm={() => undefined}
        onDeny={onDeny}
      />,
    );

    clickDeny(container);

    expect(onDeny).toHaveBeenCalledWith("comp-1");
    expect(toastInfo).toHaveBeenCalledTimes(1);
    const [message, opts] = toastInfo.mock.calls[0]! as [
      string,
      Record<string, unknown> | undefined,
    ];
    expect(message).toBe("Field removed.");
    // The lie was the `action` — it must be gone.
    expect(opts?.action).toBeUndefined();

    cleanup();
  });

  it("user-drawn deny raises no toast at all", () => {
    const onDeny = vi.fn();
    const { container, cleanup } = render(
      <ConfirmDenyControls
        componentId="comp-2"
        isAutoDetected={false}
        onConfirm={() => undefined}
        onDeny={onDeny}
      />,
    );

    clickDeny(container);

    expect(onDeny).toHaveBeenCalledWith("comp-2");
    expect(toastInfo).not.toHaveBeenCalled();

    cleanup();
  });
});
