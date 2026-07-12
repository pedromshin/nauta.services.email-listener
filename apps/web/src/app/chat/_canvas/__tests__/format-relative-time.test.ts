/**
 * format-relative-time.test.ts — formatRelativeTime (52-04-PLAN.md Task 1,
 * TDD): the four vocabulary branches (seconds -> "just now", minutes, hours,
 * days) with correct singular/plural pluralization, matching
 * history-island.tsx's original strings verbatim.
 */

import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "../format-relative-time";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function isoMsAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

describe("formatRelativeTime", () => {
  it('returns "just now" for timestamps under 60 seconds old', () => {
    expect(formatRelativeTime(isoMsAgo(0))).toBe("just now");
    expect(formatRelativeTime(isoMsAgo(45_000))).toBe("just now");
  });

  it("returns singular/plural minute(s) ago", () => {
    expect(formatRelativeTime(isoMsAgo(MINUTE_MS))).toBe("1 minute ago");
    expect(formatRelativeTime(isoMsAgo(5 * MINUTE_MS))).toBe("5 minutes ago");
  });

  it("returns singular/plural hour(s) ago", () => {
    expect(formatRelativeTime(isoMsAgo(HOUR_MS))).toBe("1 hour ago");
    expect(formatRelativeTime(isoMsAgo(3 * HOUR_MS))).toBe("3 hours ago");
  });

  it("returns singular/plural day(s) ago", () => {
    expect(formatRelativeTime(isoMsAgo(DAY_MS))).toBe("1 day ago");
    expect(formatRelativeTime(isoMsAgo(5 * DAY_MS))).toBe("5 days ago");
  });

  it("degrades to the raw string for an unparsable ISO value", () => {
    expect(formatRelativeTime("not-a-date")).toBe("not-a-date");
  });
});
