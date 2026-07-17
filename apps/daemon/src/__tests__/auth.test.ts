import { describe, expect, it } from "vitest";

import { isAuthorized, readDaemonToken } from "../server/auth.js";

/**
 * The token is the ONLY gate on a process that can read, write and execute on this PC. localhost
 * is not a trust boundary by itself — any local process can dial 127.0.0.1.
 */
describe("readDaemonToken — refuse to boot without a real secret (DMON-01)", () => {
  it("throws naming DAEMON_TOKEN when absent", () => {
    expect(() => readDaemonToken({})).toThrow(/DAEMON_TOKEN/);
  });

  it("throws when empty", () => {
    expect(() => readDaemonToken({ DAEMON_TOKEN: "" })).toThrow(/DAEMON_TOKEN/);
  });

  it("throws when shorter than 16 chars (a guessable token is no token)", () => {
    expect(() => readDaemonToken({ DAEMON_TOKEN: "short" })).toThrow(/16/);
  });

  it("throws when whitespace-padding is all that reaches 16 chars", () => {
    expect(() => readDaemonToken({ DAEMON_TOKEN: "abc             " })).toThrow();
  });

  it("returns a 32-char token", () => {
    const token = "a".repeat(32);
    expect(readDaemonToken({ DAEMON_TOKEN: token })).toBe(token);
  });

  it("never puts the token in the thrown message (T-65-16)", () => {
    const token = "tiny";
    try {
      readDaemonToken({ DAEMON_TOKEN: token });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain(token);
    }
  });
});

describe("isAuthorized — timing-safe, exact match only (T-65-11)", () => {
  const expected = "correct-horse-battery-staple-01";

  it("rejects a missing header", () => {
    expect(isAuthorized(undefined, expected)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(isAuthorized("", expected)).toBe(false);
  });

  it("rejects a wrong token", () => {
    expect(isAuthorized("totally-wrong-value-here-0000001", expected)).toBe(false);
  });

  it("rejects a NEAR MISS (last char flipped)", () => {
    expect(isAuthorized(`${expected.slice(0, -1)}2`, expected)).toBe(false);
  });

  it("rejects a correct token with trailing whitespace (no trimming — exact bytes)", () => {
    expect(isAuthorized(`${expected} `, expected)).toBe(false);
  });

  it("rejects a prefix of the correct token", () => {
    expect(isAuthorized(expected.slice(0, -1), expected)).toBe(false);
  });

  it("rejects the correct token with extra bytes appended", () => {
    expect(isAuthorized(`${expected}x`, expected)).toBe(false);
  });

  it("accepts the exact token", () => {
    expect(isAuthorized(expected, expected)).toBe(true);
  });
});
