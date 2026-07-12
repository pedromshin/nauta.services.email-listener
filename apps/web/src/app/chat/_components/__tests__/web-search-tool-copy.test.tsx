/**
 * web-search-tool-copy.test.tsx — web_search tool-round copy-map entries
 * (CLUS-03 UI surface, 54-UI-SPEC.md Component 4 — zero new components,
 * reuses `ToolRoundActivityRow`/`ToolInvocationResultRow` verbatim, only two
 * copy-map entries added).
 *
 * Mounts the REAL components — mirrors this repo's createRoot-in-jsdom +
 * `act` convention (tool-invocation-result-row.test.tsx).
 */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ToolRoundActivityRow } from "../tool-round-activity-row";
import { ToolInvocationResultRow } from "../tool-invocation-result-row";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

afterEach(() => {
  for (const c of containers) {
    document.body.removeChild(c);
  }
  containers = [];
});

describe("web_search tool-round copy (CLUS-03)", () => {
  it("ToolRoundActivityRow renders 'Searching the web…' for a web_search round (in-progress)", async () => {
    const container = await mount(<ToolRoundActivityRow toolName="web_search" />);
    expect(container.textContent).toContain("Searching the web…");
  });

  it("ToolInvocationResultRow renders 'Searched the web' for a successful web_search result", async () => {
    const content = JSON.stringify({
      mode: "search",
      results: [
        { title: "Result A", url: "https://example.com/a", snippet: "a" },
        { title: "Result B", url: "https://example.com/b", snippet: "b" },
      ],
    });
    const container = await mount(
      <ToolInvocationResultRow toolName="web_search" content={content} isError={false} />,
    );
    expect(container.textContent).toContain("Searched the web — 2 results");
  });

  it("ToolInvocationResultRow renders \"Couldn't search the web.\" for an error result", async () => {
    const container = await mount(
      <ToolInvocationResultRow
        toolName="web_search"
        content="Tool execution failed: network error"
        isError={true}
      />,
    );
    expect(container.textContent).toContain("Couldn't search the web.");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("a web_search result renders WITHOUT citation chips (Judgment Call #7 — no-citation path)", async () => {
    const content = JSON.stringify({
      mode: "search",
      results: [{ title: "Result A", url: "https://example.com/a", snippet: "a" }],
    });
    const container = await mount(
      <ToolInvocationResultRow toolName="web_search" content={content} isError={false} />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("singular '1 result' (not '1 results') for a single web_search hit", async () => {
    const content = JSON.stringify({
      results: [{ title: "Only one", url: "https://example.com/only", snippet: "" }],
    });
    const container = await mount(
      <ToolInvocationResultRow toolName="web_search" content={content} isError={false} />,
    );
    expect(container.textContent).toContain("Searched the web — 1 result");
    expect(container.textContent).not.toContain("1 results");
  });

  it("zero results renders the zero-results label variant", async () => {
    const content = JSON.stringify({ results: [] });
    const container = await mount(
      <ToolInvocationResultRow toolName="web_search" content={content} isError={false} />,
    );
    expect(container.textContent).toContain("Searched the web — no results found");
  });
});
