/**
 * markdown-renderer.test.tsx — unit tests for the sanitized assistant-markdown
 * renderer (CHAT-07, D-28).
 *
 * Security contracts under test:
 *   T-22-10: rehype-raw is never used, so raw HTML in model-generated markdown
 *            never reaches the live DOM as parsed elements (react-markdown's
 *            default behavior renders it as inert text). rehype-sanitize adds
 *            defense-in-depth on top.
 *   T-22-11: fenced code content renders as inert highlighted text, never eval'd.
 *
 * Typography contract under test (22-UI-SPEC.md):
 *   Markdown headings map into the app's existing 2-weight system — text-base
 *   font-semibold (Heading role) — never a third weight (no font-medium).
 *
 * Test environment: jsdom + react-dom/client (no @testing-library/react needed —
 * matches packages/genui's existing test convention).
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Forward declaration — will fail until markdown-renderer.tsx is created (RED).
import { MarkdownRenderer } from "../markdown-renderer";

let containers: HTMLDivElement[] = [];

function mount(element: React.ReactElement): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return container;
}

describe("MarkdownRenderer", () => {
  beforeEach(() => {
    containers = [];
  });

  afterEach(() => {
    for (const c of containers) {
      document.body.removeChild(c);
    }
    containers = [];
  });

  it("renders headings at the Heading weight and inline code as a <code> element", () => {
    const container = mount(
      <MarkdownRenderer content={"# H1\n\n**bold** and `code`"} />,
    );

    const heading = container.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading?.className).toContain("font-semibold");

    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("code");

    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("bold");

    // No raw HTML string injected — content is structured DOM, not a text blob
    // containing literal markdown syntax like "**bold**" or "# H1".
    expect(container.textContent).not.toContain("**bold**");
    expect(container.textContent).not.toContain("# H1");
  });

  it("renders a fenced code block as a highlighted <pre><code>", () => {
    const md = "```ts\nconst x: number = 1;\n```";
    const container = mount(<MarkdownRenderer content={md} />);

    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();

    const code = pre?.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.className).toMatch(/language-ts|hljs/);

    // rehype-highlight wraps tokens in classed spans when highlighting succeeds.
    const highlightedSpan = code?.querySelector("span[class*='hljs-']");
    expect(highlightedSpan).not.toBeNull();
  });

  it("renders a GFM table", () => {
    const md = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    const container = mount(<MarkdownRenderer content={md} />);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelectorAll("th").length).toBe(2);
    expect(table?.querySelectorAll("td").length).toBe(2);
  });

  it("strips/neutralizes raw HTML — no onerror-bearing <img> reaches the DOM", () => {
    const md = "before <img src=x onerror=alert(1)> after";
    const container = mount(<MarkdownRenderer content={md} />);

    const img = container.querySelector("img[onerror]");
    expect(img).toBeNull();
    // No live <img> element should be created from raw HTML at all (default
    // react-markdown behavior without rehype-raw renders it as inert text).
    expect(container.querySelectorAll("img").length).toBe(0);
  });

  it("maps h1, h2, and h3 to the same Heading weight — no third weight introduced", () => {
    const md = "# One\n\n## Two\n\n### Three";
    const container = mount(<MarkdownRenderer content={md} />);

    for (const tag of ["h1", "h2", "h3"]) {
      const el = container.querySelector(tag);
      expect(el, `missing <${tag}>`).not.toBeNull();
      expect(el?.className).toContain("text-base");
      expect(el?.className).toContain("font-semibold");
      expect(el?.className).not.toContain("font-medium");
    }
  });
});
