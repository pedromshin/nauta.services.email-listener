/**
 * email-body-pane.test.tsx — the body-only-email readability gate.
 *
 * Body-only emails (no attachment bytes) used to render nothing but "No
 * document open". EmailBodyPane now renders the message itself. This gate
 * asserts: plain text shows; HTML is sanitized (script stripped) and shown;
 * a wholly-empty email shows the honest empty state, not a blank frame.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EmailBodyPane } from "../email-body-pane";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("EmailBodyPane", () => {
  it("renders the plain-text body when there is no HTML", () => {
    act(() => {
      root.render(
        <EmailBodyPane bodyText="Hello from a body-only email." bodyHtml={null} />,
      );
    });
    expect(container.textContent).toContain("Hello from a body-only email.");
  });

  it("sanitizes and renders the HTML body, stripping active content", () => {
    act(() => {
      root.render(
        <EmailBodyPane
          bodyText={null}
          bodyHtml={'<p>Safe <strong>rich</strong> body</p><script>alert(1)</script>'}
        />,
      );
    });
    // DOMPurify runs in a mount effect; act() flushed it.
    expect(container.textContent).toContain("Safe");
    expect(container.textContent).toContain("rich");
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("alert(1)");
  });

  it("shows an honest empty state when the email has neither body nor attachment", () => {
    act(() => {
      root.render(<EmailBodyPane bodyText={null} bodyHtml={null} />);
    });
    expect(container.textContent).toContain(
      "no readable body or attachments",
    );
  });

  it("treats whitespace-only body as empty", () => {
    act(() => {
      root.render(<EmailBodyPane bodyText={"   \n  "} bodyHtml={"   "} />);
    });
    expect(container.textContent).toContain(
      "no readable body or attachments",
    );
  });
});
