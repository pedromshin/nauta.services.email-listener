/**
 * file-tree.test.tsx — FileTree (ADOPT-02) unit tests: renders folders+files
 * from data, clicking a file leaf fires onSelect with the node, the
 * `selectedId` row carries the selected treatment, folder toggle expands its
 * children and swaps the folder glyph, and no rendered row carries a bold
 * (unregular) font weight.
 *
 * Mounts the REAL component — mirrors this repo's createRoot-in-jsdom + `act`
 * convention (json-pane.test.tsx / empty-state.test.tsx).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileTree, type FileTreeNode } from "./file-tree";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DATA: readonly FileTreeNode[] = [
  {
    id: "curveball",
    name: "Curveball — soundscape mixer (canvas)",
    type: "folder",
    children: [{ id: "curveball/island.js", name: "island.js", type: "file" }],
  },
  { id: "readme", name: "readme.md", type: "file" },
];

let containers: HTMLDivElement[] = [];

async function mount(element: React.ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return container;
}

function findButtonByText(container: HTMLDivElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
  expect(button).not.toBeUndefined();
  return button!;
}

describe("FileTree", () => {
  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  it("renders folders and files from data", async () => {
    const container = await mount(
      <FileTree data={DATA} defaultExpandedIds={["curveball"]} />,
    );

    expect(container.textContent).toContain("Curveball — soundscape mixer (canvas)");
    expect(container.textContent).toContain("island.js");
    expect(container.textContent).toContain("readme.md");
  });

  it("clicking a file leaf fires onSelect with the file node", async () => {
    const onSelect = vi.fn();
    const container = await mount(
      <FileTree data={DATA} defaultExpandedIds={["curveball"]} onSelect={onSelect} />,
    );

    const fileButton = findButtonByText(container, "island.js");
    await act(async () => {
      fileButton.click();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      id: "curveball/island.js",
      name: "island.js",
      type: "file",
    });
  });

  it("the selectedId row carries the selected treatment", async () => {
    const container = await mount(
      <FileTree data={DATA} defaultExpandedIds={["curveball"]} selectedId="curveball/island.js" />,
    );

    const fileButton = findButtonByText(container, "island.js");
    expect(fileButton.className).toContain("text-primary");
    expect(fileButton.className).toContain("bg-primary/10");

    const readmeButton = findButtonByText(container, "readme.md");
    expect(readmeButton.className).not.toContain("text-primary");
  });

  it("clicking a folder trigger expands it and swaps the folder glyph", async () => {
    const container = await mount(<FileTree data={DATA} />);

    // Closed by default: nested file content is not rendered, closed-folder glyph shown.
    expect(container.textContent).not.toContain("island.js");
    expect(container.querySelector(".lucide-folder-open")).toBeNull();
    expect(container.querySelector(".lucide-folder")).not.toBeNull();

    const folderTrigger = findButtonByText(
      container,
      "Curveball — soundscape mixer (canvas)",
    );
    expect(folderTrigger.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      folderTrigger.click();
    });

    expect(folderTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("island.js");
    expect(container.querySelector(".lucide-folder-open")).not.toBeNull();
  });

  it("no rendered row className contains a bold (medium-weight) font class", async () => {
    const container = await mount(
      <FileTree data={DATA} defaultExpandedIds={["curveball"]} />,
    );

    const elements = container.querySelectorAll("[class]");
    for (const el of Array.from(elements)) {
      expect(el.className).not.toContain("font-medium");
    }
  });
});
