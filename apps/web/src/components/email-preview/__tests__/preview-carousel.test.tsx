/**
 * preview-carousel.test.tsx — structural behavior gate for the hand-rolled
 * scroll-snap carousel.
 *
 * jsdom does NO layout: scroll-snap, IntersectionObserver, and slide
 * geometry are invisible here (the geometry/screenshot gates own those).
 * What IS honestly assertable in jsdom, and what this gate covers:
 *   - every slide renders with the snap classes the CSS mechanic requires
 *     (`snap-center`, `shrink-0`, `w-full`) inside a `snap-x snap-mandatory
 *     overflow-x-auto` track;
 *   - slide 0 is ALWAYS the body;
 *   - lazy mount: only active ± 1 slides have content, the rest are empty;
 *   - prev/next buttons move the active index, update the label strip and
 *     the position counter, and disable at the ends.
 *
 * The react-pdf-bearing AttachmentPageView is vi.mock'd — pdfjs must never
 * load in the inbox test environment (that is the whole point of the
 * next/dynamic seam), and the mock intercepts the dynamic import too.
 */

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Intercepts BOTH the static and the next/dynamic import of the react-pdf
// bearing module — react-pdf/pdfjs never loads in jsdom.
vi.mock("../attachment-page-view", () => ({
  AttachmentPageView: (props: {
    attachmentId: string;
    pageNumber: number;
  }) => (
    <div
      data-testid="attachment-view"
      data-attachment-id={props.attachmentId}
      data-page={props.pageNumber}
    />
  ),
}));

import { PreviewCarousel } from "../preview-carousel";

import type { PreviewSlide } from "../use-email-preview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const ATT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const SLIDES: ReadonlyArray<PreviewSlide> = [
  { kind: "body", key: "body", label: "Body" },
  {
    kind: "pdf-page",
    key: `${ATT_ID}:1`,
    label: "invoice.pdf · page 1",
    attachmentId: ATT_ID,
    filename: "invoice.pdf",
    contentType: "application/pdf",
    pageNumber: 1,
  },
  {
    kind: "pdf-page",
    key: `${ATT_ID}:2`,
    label: "invoice.pdf · page 2",
    attachmentId: ATT_ID,
    filename: "invoice.pdf",
    contentType: "application/pdf",
    pageNumber: 2,
  },
  {
    kind: "pdf-page",
    key: `${ATT_ID}:3`,
    label: "invoice.pdf · page 3",
    attachmentId: ATT_ID,
    filename: "invoice.pdf",
    contentType: "application/pdf",
    pageNumber: 3,
  },
];

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

async function mountCarousel(
  slides: ReadonlyArray<PreviewSlide> = SLIDES,
): Promise<void> {
  await act(async () => {
    root.render(
      <PreviewCarousel
        slides={slides}
        bodyText="The plain-text body."
        bodyHtml={null}
      />,
    );
  });
  // Flush the next/dynamic lazy import of the (mocked) attachment view.
  await act(async () => {
    await Promise.resolve();
  });
}

function slideEls(): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-slide-index]"),
  );
}

function buttonByLabel(label: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  if (!el) throw new Error(`No button labelled "${label}"`);
  return el;
}

describe("PreviewCarousel (structure — jsdom does no layout)", () => {
  it("renders every slide as a snap target inside a snap-mandatory track, body first", async () => {
    await mountCarousel();

    const track = container.querySelector<HTMLElement>("[data-carousel-track]");
    expect(track).not.toBeNull();
    expect(track?.className).toContain("overflow-x-auto");
    expect(track?.className).toContain("snap-x");
    expect(track?.className).toContain("snap-mandatory");

    const slides = slideEls();
    expect(slides).toHaveLength(SLIDES.length);
    for (const el of slides) {
      expect(el.className).toContain("snap-center");
      expect(el.className).toContain("shrink-0");
      expect(el.className).toContain("w-full");
    }

    expect(slides[0]?.getAttribute("data-slide-kind")).toBe("body");
    expect(slides[0]?.textContent).toContain("The plain-text body.");
  });

  it("lazy-mounts only active ± 1 slides", async () => {
    await mountCarousel();

    const slides = slideEls();
    // active = 0: body + page 1 mounted; pages 2 and 3 empty shells.
    expect(slides[0]?.childElementCount).toBeGreaterThan(0);
    expect(slides[1]?.childElementCount).toBeGreaterThan(0);
    expect(slides[2]?.childElementCount).toBe(0);
    expect(slides[3]?.childElementCount).toBe(0);
  });

  it("next/prev buttons move the active index, label strip, and counter; ends disable", async () => {
    await mountCarousel();

    const label = () =>
      container.querySelector("[data-carousel-label]")?.textContent;

    expect(label()).toBe("Body");
    expect(buttonByLabel("Previous slide").disabled).toBe(true);
    expect(buttonByLabel("Next slide").disabled).toBe(false);
    expect(container.textContent).toContain("1 / 4");

    await act(async () => {
      buttonByLabel("Next slide").click();
    });
    expect(label()).toBe("invoice.pdf · page 1");
    expect(container.textContent).toContain("2 / 4");
    expect(buttonByLabel("Previous slide").disabled).toBe(false);

    // Advancing shifts the lazy-mount window: slide 2 mounts now.
    const slides = slideEls();
    expect(slides[2]?.childElementCount).toBeGreaterThan(0);
    expect(
      slides[1]?.querySelector('[data-testid="attachment-view"]'),
    ).not.toBeNull();
    expect(
      slides[1]
        ?.querySelector('[data-testid="attachment-view"]')
        ?.getAttribute("data-page"),
    ).toBe("1");

    // Walk to the far end — Next disables there.
    await act(async () => {
      buttonByLabel("Next slide").click();
    });
    await act(async () => {
      buttonByLabel("Next slide").click();
    });
    expect(label()).toBe("invoice.pdf · page 3");
    expect(container.textContent).toContain("4 / 4");
    expect(buttonByLabel("Next slide").disabled).toBe(true);

    // And back down.
    await act(async () => {
      buttonByLabel("Previous slide").click();
    });
    expect(label()).toBe("invoice.pdf · page 2");
  });

  it("renders no controls strip for a single (body-only) deck", async () => {
    await mountCarousel([{ kind: "body", key: "body", label: "Body" }]);

    expect(container.querySelector("[data-carousel-controls]")).toBeNull();
    expect(slideEls()).toHaveLength(1);
  });
});
