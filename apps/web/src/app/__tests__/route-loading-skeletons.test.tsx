/**
 * route-loading-skeletons.test.tsx — behavioral gate for the route-level
 * `loading.tsx` fallbacks (snappiness plan §1: the plan found ZERO loading.tsx
 * files, so every navigation painted a blank viewport until hydration+fetch).
 *
 * Each fallback must (a) render without a provider tree — a loading.tsx runs
 * BEFORE any client context exists, so a stray `api.` or store import would
 * crash the route shell; (b) announce itself accessibly (role="status" +
 * aria-busy); (c) reproduce its page's load-bearing layout classes so the
 * skeleton→page swap is zero-shift (the geometry/CLS proof itself is a
 * real-browser gate — jsdom does no layout; THIS test only pins the class
 * strings and structure).
 *
 * renderToString (not createRoot): fallbacks are static by contract — if one
 * ever grows an effect or fetch, SSR rendering here is exactly the discipline
 * that should flag it.
 */

// Explicit React import — vitest's classic-runtime esbuild transform needs
// `React` in scope for this file's own JSX (codebase gotcha).
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CapabilitiesLoading from "../capabilities/loading";
import ChatLoading from "../chat/loading";
import EmailDetailLoading from "../emails/[id]/loading";
import EntityTypesLoading from "../entity-types/loading";
import FilesLoading from "../files/loading";
import KnowledgeLoading from "../knowledge/loading";
import InboxLoading from "../loading";
import ReferencesLoading from "../references/loading";

interface LoadingCase {
  readonly name: string;
  readonly Component: () => React.ReactElement;
  /** Markers the rendered HTML must contain. */
  readonly markers: ReadonlyArray<string>;
}

const CASES: ReadonlyArray<LoadingCase> = [
  {
    name: "inbox (/)",
    Component: InboxLoading,
    markers: [
      'aria-label="Loading inbox"',
      // The page's own height budget — layout identity with page.tsx.
      "h-[calc(100svh-var(--app-tabbar-h))]",
      // Static shell chrome rendered as the real thing.
      ">Inbox<",
      ">Filters<",
    ],
  },
  {
    name: "email detail (/emails/[id])",
    Component: EmailDetailLoading,
    markers: [
      'aria-label="Loading…"',
      // EmailDetail's own isLoading frame: header rule then canvas zone.
      "border-b border-hair",
      "rounded-card",
    ],
  },
  {
    name: "knowledge (/knowledge)",
    Component: KnowledgeLoading,
    markers: [
      // Reuses the surface's own skeleton — same aria contract.
      'aria-label="Loading knowledge graph"',
      // The page shell's exact height budget.
      "h-[calc(100vh-3.5rem)]",
    ],
  },
  {
    name: "files (/files)",
    Component: FilesLoading,
    markers: [
      'aria-label="Loading files"',
      ">Files<",
      "min-h-[calc(100vh-3.5rem)]",
      "bg-shelf",
    ],
  },
  {
    name: "capabilities (/capabilities)",
    Component: CapabilitiesLoading,
    markers: [
      'aria-label="Loading capabilities"',
      ">Capabilities<",
      "min-h-[calc(100vh-3.5rem)]",
    ],
  },
  {
    name: "references (/references)",
    Component: ReferencesLoading,
    markers: [
      'aria-label="Loading references"',
      ">References<",
      "min-h-[calc(100vh-3.5rem)]",
    ],
  },
  {
    name: "entity-types (/entity-types)",
    Component: EntityTypesLoading,
    markers: [
      'aria-label="Loading entity types"',
      ">Entity types<",
      "h-[calc(100svh-var(--app-tabbar-h))]",
      // The page's md master-rail width.
      "md:w-72",
    ],
  },
  {
    name: "chat (/chat)",
    Component: ChatLoading,
    markers: [
      'aria-label="Loading chat"',
      "h-[calc(100svh-var(--app-tabbar-h))]",
      // RAIL_WIDTH (conversation-rail.tsx) — the rail ghost must hold the
      // same 208px so the loaded rail swaps in without shift.
      "w-52",
      // The single h-11 header rule the main column hangs off.
      "h-11",
    ],
  },
];

describe("route-level loading fallbacks (snappiness plan §1)", () => {
  for (const { name, Component, markers } of CASES) {
    it(`${name}: renders statically with an accessible busy state and its page's frame`, () => {
      const html = renderToString(<Component />);

      // (b) accessible busy announcement.
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');

      // (c) page-specific layout identity markers.
      for (const marker of markers) {
        expect(html, `${name} missing marker: ${marker}`).toContain(marker);
      }
    });
  }

  it("every fallback is provider-free (renders outside any tRPC/query context)", () => {
    // renderToString above already proves it — a useQuery/useContext(null)
    // in any fallback throws synchronously. This assertion documents the
    // contract explicitly.
    for (const { Component } of CASES) {
      expect(() => renderToString(<Component />)).not.toThrow();
    }
  });
});
