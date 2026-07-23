"use client";

/**
 * preview-carousel.tsx — hand-rolled CSS scroll-snap carousel for the inbox
 * inline email preview. NO embla, NO new deps.
 *
 * Mechanics:
 *   - Track: `overflow-x-auto snap-x snap-mandatory`; each slide is
 *     `w-full shrink-0 snap-center`, so a swipe/scroll always settles on
 *     exactly one slide.
 *   - Active index: an IntersectionObserver (root = the track, threshold
 *     0.6) follows real scroll position; the prev/next buttons ALSO set the
 *     index directly so keyboard/click stays snappy (and jsdom — which has
 *     no IntersectionObserver and no layout — still exercises the state).
 *   - Lazy mount: only the active slide ± 1 render content. Combined with
 *     the per-slide lazy signed-URL fetch, an email with a 30-page PDF costs
 *     at most three mounted slides at a time.
 *   - The react-pdf-bearing AttachmentPageView loads via next/dynamic
 *     (ssr: false) so pdfjs never ships with the inbox shell and only loads
 *     when an attachment slide first becomes near-active.
 */

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@polytoken/ui/button";
import { Skeleton } from "@polytoken/ui/skeleton";

import { EmailBodyView } from "./body-view";

import type { EmailPreviewComponent, PreviewSlide } from "./use-email-preview";

const AttachmentPageView = dynamic(
  () => import("./attachment-page-view").then((m) => m.AttachmentPageView),
  {
    ssr: false,
    loading: () => (
      <div className="p-panel">
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    ),
  },
);

interface PreviewCarouselProps {
  readonly slides: ReadonlyArray<PreviewSlide>;
  readonly bodyText: string | null;
  readonly bodyHtml: string | null;
  /** The email's region components — routed to body/page overlays. */
  readonly components?: ReadonlyArray<EmailPreviewComponent>;
  /** Bubbles react-pdf's numPages up so PDFs expand to per-page slides. */
  readonly onDocumentLoad?: (attachmentId: string, numPages: number) => void;
}

export function PreviewCarousel({
  slides,
  bodyText,
  bodyHtml,
  components = [],
  onDocumentLoad,
}: PreviewCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  // Clamp if the slide list shrinks under us (e.g. selection change without
  // a parent re-key, or a PDF resolving to fewer pages than assumed).
  useEffect(() => {
    if (activeIndex > slides.length - 1) {
      setActiveIndex(Math.max(0, slides.length - 1));
    }
  }, [slides.length, activeIndex]);

  // Follow real scroll position (trackpad swipe, touch) — jsdom has no
  // IntersectionObserver, so tests drive the index via the buttons instead.
  useEffect(() => {
    const track = trackRef.current;
    if (track === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const raw = (entry.target as HTMLElement).dataset.slideIndex;
          const index = raw === undefined ? Number.NaN : Number(raw);
          if (!Number.isNaN(index)) setActiveIndex(index);
        }
      },
      { root: track, threshold: 0.6 },
    );
    for (const el of Array.from(
      track.querySelectorAll<HTMLElement>("[data-slide-index]"),
    )) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, [slides.length]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, index));
      setActiveIndex(clamped);
      const track = trackRef.current;
      // Optional-call: jsdom implements neither Element.scrollTo nor layout.
      track?.scrollTo?.({
        left: clamped * track.clientWidth,
        behavior: "smooth",
      });
    },
    [slides.length],
  );

  if (slides.length === 0) return null;

  const boundedActive = Math.min(activeIndex, slides.length - 1);
  const activeSlide = slides[boundedActive]!;

  function renderSlideContent(slide: PreviewSlide): React.ReactElement {
    if (slide.kind === "body") {
      return (
        <EmailBodyView
          bodyText={bodyText}
          bodyHtml={bodyHtml}
          components={components.length > 0 ? components : undefined}
        />
      );
    }
    return (
      <AttachmentPageView
        attachmentId={slide.attachmentId}
        filename={slide.filename}
        contentType={slide.contentType}
        pageNumber={slide.kind === "pdf-page" ? slide.pageNumber : 1}
        components={components}
        onDocumentLoad={onDocumentLoad}
      />
    );
  }

  return (
    <div
      data-carousel
      className="flex min-h-0 flex-1 flex-col"
      aria-roledescription="carousel"
      aria-label="Email preview"
    >
      <div
        ref={trackRef}
        data-carousel-track
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.key}
            role="group"
            aria-roledescription="slide"
            aria-label={slide.label}
            data-slide-index={index}
            data-slide-kind={slide.kind}
            className="w-full shrink-0 snap-center overflow-hidden"
          >
            {/* Lazy mount: active ± 1 only — the neighbors are warm for the
                next swipe, everything further costs nothing. */}
            {Math.abs(index - boundedActive) <= 1
              ? renderSlideContent(slide)
              : null}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div
          data-carousel-controls
          className="mt-2 flex shrink-0 items-center gap-2 border-t border-hair pt-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous slide"
            disabled={boundedActive <= 0}
            onClick={() => goTo(boundedActive - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          {/* Compact label strip: what am I looking at (Body / filename ·
              page N) + where am I in the deck. */}
          <div
            data-carousel-label
            className="min-w-0 flex-1 truncate text-center text-xs text-faded"
          >
            {activeSlide.label}
          </div>
          <span className="tabular text-2xs text-pencil">
            {boundedActive + 1} / {slides.length}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next slide"
            disabled={boundedActive >= slides.length - 1}
            onClick={() => goTo(boundedActive + 1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
