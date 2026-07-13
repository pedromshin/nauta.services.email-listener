/**
 * add-knowledge-preview-popover.test.tsx — AddKnowledgePreviewPopover
 * (PREV-01, 41-UI-SPEC.md section 6): trigger discoverability, disabled/
 * validation/success/cancel states of the paste-a-UUID creation form.
 *
 * `PopoverContent` renders through a Radix `Portal` (appended to
 * `document.body`, not inside the mounted container) — form-field
 * assertions query `document.body` directly; `root.unmount()` in
 * `afterEach` tears down the portaled content between tests (mirrors this
 * repo's createRoot-in-jsdom + `act` convention).
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable per-test payload for the mocked knowledge.list query (the picker
// rows added post-Phase-54; defaults empty so the original manual-ID tests
// exercise the form exactly as before).
interface MockListItem {
  readonly id: string;
  readonly title: string | null;
  readonly source: string | null;
  readonly scopeRefType: string | null;
}
let mockListItems: MockListItem[] = [];

vi.mock("~/trpc/react", () => ({
  api: {
    knowledge: {
      list: {
        useQuery: () => ({ data: { items: mockListItems } }),
      },
    },
  },
}));

import { AddKnowledgePreviewPopover } from "../add-knowledge-preview-popover";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

let containers: HTMLDivElement[] = [];
let roots: Root[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return container;
}

beforeEach(() => {
  mockListItems = [];
});

afterEach(async () => {
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  for (const c of containers) {
    c.remove();
  }
  containers = [];
  roots = [];
});

function getTrigger(container: HTMLDivElement): HTMLButtonElement {
  const trigger = container.querySelector('button[aria-label="Add knowledge preview"]');
  expect(trigger).not.toBeNull();
  return trigger as HTMLButtonElement;
}

async function openPopover(container: HTMLDivElement): Promise<void> {
  await act(async () => {
    getTrigger(container).click();
  });
}

function nodeIdInputEl(): HTMLInputElement | null {
  return document.body.querySelector("#kp-node-id");
}

function labelInputEl(): HTMLInputElement | null {
  return document.body.querySelector("#kp-label");
}

function addPreviewButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll("button"));
  return (buttons.find((b) => b.textContent === "Add preview") as HTMLButtonElement) ?? null;
}

function cancelButton(): HTMLButtonElement | null {
  const buttons = Array.from(document.body.querySelectorAll("button"));
  return (buttons.find((b) => b.textContent === "Cancel") as HTMLButtonElement) ?? null;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AddKnowledgePreviewPopover", () => {
  // Test 1
  it("trigger renders with aria-label; clicking reveals the form fields/buttons", async () => {
    const container = await mount(<AddKnowledgePreviewPopover onAdd={vi.fn()} />);

    const trigger = getTrigger(container);
    expect(trigger.getAttribute("aria-label")).toBe("Add knowledge preview");

    expect(nodeIdInputEl()).toBeNull();

    await openPopover(container);

    expect(nodeIdInputEl()).not.toBeNull();
    expect(labelInputEl()).not.toBeNull();
    expect(addPreviewButton()).not.toBeNull();
    expect(cancelButton()).not.toBeNull();
  });

  // Test 2
  it("'Add preview' is disabled while the node-id input is empty or whitespace-only", async () => {
    const container = await mount(<AddKnowledgePreviewPopover onAdd={vi.fn()} />);
    await openPopover(container);

    expect(addPreviewButton()?.disabled).toBe(true);

    await act(async () => {
      setInputValue(nodeIdInputEl()!, "   ");
    });
    expect(addPreviewButton()?.disabled).toBe(true);

    await act(async () => {
      setInputValue(nodeIdInputEl()!, VALID_UUID);
    });
    expect(addPreviewButton()?.disabled).toBe(false);
  });

  // Test 3
  it("a non-UUID value renders the inline error, never calls onAdd, popover stays open", async () => {
    const onAdd = vi.fn();
    const container = await mount(<AddKnowledgePreviewPopover onAdd={onAdd} />);
    await openPopover(container);

    await act(async () => {
      setInputValue(nodeIdInputEl()!, "not-a-uuid");
    });
    await act(async () => {
      addPreviewButton()!.click();
    });

    expect(document.body.textContent).toContain("Enter a valid knowledge node ID.");
    expect(onAdd).not.toHaveBeenCalled();
    expect(nodeIdInputEl()).not.toBeNull(); // form still present — did not close
  });

  // Test 4
  it("a valid UUID with no label calls onAdd(uuid, undefined) and closes the popover", async () => {
    const onAdd = vi.fn();
    const container = await mount(<AddKnowledgePreviewPopover onAdd={onAdd} />);
    await openPopover(container);

    await act(async () => {
      setInputValue(nodeIdInputEl()!, VALID_UUID);
    });
    await act(async () => {
      addPreviewButton()!.click();
    });

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(VALID_UUID, undefined);
    expect(nodeIdInputEl()).toBeNull(); // popover closed
    expect(document.body.textContent).not.toContain("Enter a valid knowledge node ID.");
  });

  // Test 5
  it("a valid UUID plus a label calls onAdd(uuid, label)", async () => {
    const onAdd = vi.fn();
    const container = await mount(<AddKnowledgePreviewPopover onAdd={onAdd} />);
    await openPopover(container);

    await act(async () => {
      setInputValue(nodeIdInputEl()!, VALID_UUID);
      setInputValue(labelInputEl()!, "the typed label");
    });
    await act(async () => {
      addPreviewButton()!.click();
    });

    expect(onAdd).toHaveBeenCalledWith(VALID_UUID, "the typed label");
  });

  // Test 7 (Phase 54 follow-up): the recent-knowledge picker rows
  it("lists recent knowledge nodes; clicking one calls onAdd(id, title) and closes", async () => {
    mockListItems = [
      {
        id: VALID_UUID,
        title: "AI Salary Benchmarks 2026",
        source: "web_search_capture",
        scopeRefType: "web_source",
      },
    ];
    const onAdd = vi.fn();
    const container = await mount(<AddKnowledgePreviewPopover onAdd={onAdd} />);
    await openPopover(container);

    expect(document.body.textContent).toContain("Recent knowledge");
    expect(document.body.textContent).toContain("AI Salary Benchmarks 2026");
    expect(document.body.textContent).toContain("captured web source");

    const row = Array.from(document.body.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("AI Salary Benchmarks 2026"),
    );
    expect(row).not.toBeUndefined();
    await act(async () => {
      row!.click();
    });

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith(VALID_UUID, "AI Salary Benchmarks 2026");
    expect(nodeIdInputEl()).toBeNull(); // popover closed
  });

  // Test 8: no recent nodes -> no picker section, manual form unchanged
  it("hides the recent-knowledge section when the list is empty", async () => {
    const container = await mount(<AddKnowledgePreviewPopover onAdd={vi.fn()} />);
    await openPopover(container);

    expect(document.body.textContent).not.toContain("Recent knowledge");
    expect(nodeIdInputEl()).not.toBeNull();
  });

  // Test 6
  it("'Cancel' closes the popover and never calls onAdd", async () => {
    const onAdd = vi.fn();
    const container = await mount(<AddKnowledgePreviewPopover onAdd={onAdd} />);
    await openPopover(container);

    await act(async () => {
      setInputValue(nodeIdInputEl()!, VALID_UUID);
    });
    await act(async () => {
      cancelButton()!.click();
    });

    expect(nodeIdInputEl()).toBeNull(); // popover closed
    expect(onAdd).not.toHaveBeenCalled();
  });
});
