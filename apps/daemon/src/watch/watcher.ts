/**
 * The ONE watched folder → `fs.watch.event` broadcast (DMON-04).
 *
 * `watch.root` was proven inside `roots` at config load (65-02), so every path emitted here is
 * inside the universe by construction.
 *
 * Windows specifics that shape this file:
 * - `awaitWriteFinish` — Windows fires events on PARTIAL writes. Without it a client is told a
 *   file "changed" while it is still being written, and reads a torn file. The event means the
 *   write FINISHED, not that it started (T-65-17).
 * - Watcher errors go to `onError` + a log. An unhandled chokidar error event would take the
 *   whole daemon down with it.
 *
 * R-08: `root` is the absolute canonical root; `path` is root-relative with FORWARD slashes, so
 * every client reads one path shape regardless of OS.
 */
import chokidar from "chokidar";
import nodePath from "node:path";
import type { FsWatchKind } from "@polytoken/daemon-protocol";

import type { CanonicalPath } from "../permissions/paths.js";
import type { ClientRegistry } from "../server/clients.js";

export type Watcher = { close(): Promise<void> };

/** chokidar event → protocol kind, 1:1. */
const WATCH_KINDS = ["add", "change", "unlink", "addDir", "unlinkDir"] as const satisfies readonly FsWatchKind[];

/** R-08: root-relative, forward slashes. */
export const toRelativeForwardSlash = (root: string, absolute: string): string =>
  nodePath.win32.relative(root, absolute).replace(/\\/g, "/");

export const startWatcher = (opts: {
  root: CanonicalPath;
  registry: ClientRegistry;
  onError?: (error: unknown) => void;
}): Watcher => {
  const { root, registry, onError } = opts;

  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 20 },
  });

  for (const kind of WATCH_KINDS) {
    watcher.on(kind, (absolute: string) => {
      try {
        registry.broadcast("fs.watch.event", {
          root,
          path: toRelativeForwardSlash(root, absolute),
          kind,
        });
      } catch (error) {
        onError?.(error);
      }
    });
  }

  // Never let a watcher error become an unhandled 'error' event.
  watcher.on("error", (error: unknown) => {
    onError?.(error);
    console.error(`[daemon:watch] watcher error: ${String(error)}`);
  });

  return Object.freeze({
    async close(): Promise<void> {
      await watcher.close();
    },
  });
};
