/**
 * The token gate (T-65-11).
 *
 * localhost is NOT a trust boundary by itself: any process running as this user can dial
 * 127.0.0.1:8787. The token is therefore the real gate, and it is checked at the HTTP UPGRADE —
 * before a WebSocket exists — so an unauthorized peer never gets a socket to send frames on.
 *
 * The token lives in the environment ONLY. It is never in the config file (which is committed-
 * adjacent and path-bearing), never logged, never echoed into an error message.
 */
import { timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 16;

/**
 * Read + validate `DAEMON_TOKEN`. Throws (refusing boot) rather than defaulting to anything:
 * a daemon that can execute terminal commands must not run with a weak or absent gate.
 * The message never contains the token itself.
 */
export const readDaemonToken = (env: NodeJS.ProcessEnv): string => {
  const token = env.DAEMON_TOKEN;

  if (token === undefined || token.length === 0) {
    throw new Error(
      "[daemon:auth] DAEMON_TOKEN is not set. This daemon can read, write and execute on this " +
        "machine; it refuses to start without a token. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  if (token.trim().length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `[daemon:auth] DAEMON_TOKEN must be at least ${MIN_TOKEN_LENGTH} non-whitespace characters. ` +
        "A guessable token is no token.",
    );
  }

  return token;
};

/**
 * Constant-time comparison of the presented header against the expected token.
 *
 * The length check leaks length (unavoidable — `timingSafeEqual` throws on unequal buffers), but
 * not content. No trimming, no normalization: the comparison is exact bytes, so a "correct token
 * with a trailing space" is a rejection.
 */
export const isAuthorized = (headerValue: string | undefined, expected: string): boolean => {
  if (headerValue === undefined || headerValue.length === 0) return false;

  const presented = Buffer.from(headerValue, "utf8");
  const secret = Buffer.from(expected, "utf8");
  if (presented.length !== secret.length) return false;

  return timingSafeEqual(presented, secret);
};
