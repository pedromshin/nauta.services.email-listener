/**
 * body-view.test.tsx — the body-only-email readability gate (moved alongside
 * the component from apps/web/src/app/emails/[id]/_components/__tests__/
 * email-body-pane.test.tsx).
 *
 * Body-only emails (no attachment bytes) used to render nothing but "No
 * document open". EmailBodyView now renders the message itself. This gate
 * asserts: plain text shows; HTML is sanitized (script stripped) and shown;
 * a wholly-empty email shows the honest empty state, not a blank frame; and
 * the OPTIONAL overlay capability degrades safely in jsdom (no
 * ResizeObserver, no layout → no overlay, no crash).
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EmailBodyView } from "../body-view";

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

describe("EmailBodyView", () => {
  it("renders the plain-text body when there is no HTML", () => {
    act(() => {
      root.render(
        <EmailBodyView bodyText="Hello from a body-only email." bodyHtml={null} />,
      );
    });
    expect(container.textContent).toContain("Hello from a body-only email.");
  });

  it("sanitizes and renders the HTML body, stripping active content", () => {
    act(() => {
      root.render(
        <EmailBodyView
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
      root.render(<EmailBodyView bodyText={null} bodyHtml={null} />);
    });
    expect(container.textContent).toContain(
      "no readable body or attachments",
    );
  });

  it("treats whitespace-only body as empty", () => {
    act(() => {
      root.render(<EmailBodyView bodyText={"   \n  "} bodyHtml={"   "} />);
    });
    expect(container.textContent).toContain(
      "no readable body or attachments",
    );
  });

  it("accepts the optional components prop without crashing in jsdom (overlay stays unmeasured)", () => {
    act(() => {
      root.render(
        <EmailBodyView
          bodyText="Body with a detected region."
          bodyHtml={null}
          components={[
            {
              id: "c1",
              attachmentId: null,
              sourceType: "region",
              contentText: "R$ 100,00",
              extractionStatus: "candidate",
              location: {
                type: "region",
                page_index: 0,
                polygon: [
                  [0.1, 0.1],
                  [0.4, 0.1],
                  [0.4, 0.2],
                  [0.1, 0.2],
                ],
              },
              entityTypeLabel: "Amount",
              entityTypeSlug: "amount",
              extractedFields: null,
              confidenceScore: null,
            },
          ]}
        />,
      );
    });
    // jsdom: no ResizeObserver → pageSize stays null → OverlayLayer renders
    // null. The body itself must still be readable.
    expect(container.textContent).toContain("Body with a detected region.");
    expect(container.querySelector("#region-overlay-layer")).toBeNull();
  });
});
