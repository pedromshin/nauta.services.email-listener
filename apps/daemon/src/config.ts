/**
 * The daemon's configuration — `roots` IS the universe.
 *
 * ## Usage
 *
 * Copy `daemon.config.example.json` to `daemon.config.json` (gitignored — it names real local
 * paths) beside the daemon package, and edit `roots` + `watch.root`:
 *
 * ```json
 * { "version": 1, "roots": ["C:\\Users\\you\\Projects"],
 *   "watch": { "root": "C:\\Users\\you\\Projects" }, "port": 8787 }
 * ```
 *
 * Resolution order: env `DAEMON_CONFIG` > the `explicitPath` argument > `daemon.config.json`
 * beside the package root.
 *
 * - `roots` — absolute paths bounding ALL data access (fs targets, exec/git cwd). Everything
 *   outside is denied and is NOT promptable (R-13: roots bound DATA, not the executable itself).
 * - `watch.root` — the ONE watched folder. MUST be inside `roots`: the daemon will not watch what
 *   it may not touch.
 * - `port` — 0 means "ephemeral", used by tests and the smoke script.
 * - `stateDir` — resolved relative to the config FILE's directory; holds the allowlist + audit log.
 *
 * DELIBERATELY ABSENT: `host`. The bind address is the literal "127.0.0.1" in server/daemon.ts
 * (R-07/T-65-12) — a hostile config file must not be able to expose this daemon to the network.
 * The schema is `.strict()`, so a config carrying `host` is REJECTED rather than ignored.
 *
 * Also absent: the token. `DAEMON_TOKEN` is env-only, never config (T-65-10).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { canonicalizePath, isInsideRoots, type CanonicalPath } from "./permissions/paths.js";

export const daemonConfigSchema = z
  .object({
    version: z.literal(1),
    roots: z.array(z.string().min(1)).min(1),
    watch: z.object({ root: z.string().min(1) }).strict(),
    port: z.number().int().min(0).max(65535).default(8787),
    permTimeoutMs: z.number().int().min(1_000).max(600_000).default(30_000),
    exec: z
      .object({
        defaultTimeoutMs: z.number().int().min(1).max(600_000).default(30_000),
        maxOutputBytes: z.number().int().min(1024).max(16_777_216).default(1_048_576),
      })
      .strict()
      .default({}),
    stateDir: z.string().min(1).default(".state"),
  })
  .strict();

export type DaemonConfigInput = z.infer<typeof daemonConfigSchema>;

/** The loaded, canonicalized, frozen config. Paths here are already through the boundary. */
export type DaemonConfig = {
  readonly version: 1;
  readonly roots: readonly CanonicalPath[];
  readonly watch: { readonly root: CanonicalPath };
  readonly port: number;
  readonly permTimeoutMs: number;
  readonly exec: { readonly defaultTimeoutMs: number; readonly maxOutputBytes: number };
  readonly stateDir: string;
};

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const resolveConfigPath = (explicitPath?: string): string => {
  const fromEnv = process.env.DAEMON_CONFIG;
  if (fromEnv !== undefined && fromEnv.length > 0) return path.resolve(fromEnv);
  if (explicitPath !== undefined && explicitPath.length > 0) return path.resolve(explicitPath);
  return path.join(packageRoot, "daemon.config.json");
};

/**
 * Load + validate the config, canonicalize its paths, and prove watch.root is inside roots.
 * Throws with an actionable message — a daemon with an invalid universe must not boot.
 */
export const loadConfig = (explicitPath?: string): DaemonConfig => {
  const configPath = resolveConfigPath(explicitPath);

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `[daemon:config] no config file at ${configPath}. Copy daemon.config.example.json to ` +
          `daemon.config.json and set "roots" + "watch.root", or point DAEMON_CONFIG at a file.`,
      );
    }
    throw new Error(`[daemon:config] could not read ${configPath}: ${(error as Error).message}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error(`[daemon:config] ${configPath} is not valid JSON: ${(error as Error).message}`);
  }

  const parsed = daemonConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`[daemon:config] ${configPath} is invalid: ${issues}`);
  }

  const roots: CanonicalPath[] = parsed.data.roots.map((root) => {
    const result = canonicalizePath(root);
    if (!result.ok) {
      throw new Error(`[daemon:config] root "${root}" is not a usable absolute path: ${result.reason}`);
    }
    return result.path;
  });

  const watchRoot = canonicalizePath(parsed.data.watch.root);
  if (!watchRoot.ok) {
    throw new Error(
      `[daemon:config] watch.root "${parsed.data.watch.root}" is not a usable absolute path: ${watchRoot.reason}`,
    );
  }

  // The watcher must not see what the tools may not touch.
  if (!isInsideRoots(watchRoot.path, roots)) {
    throw new Error(
      `[daemon:config] watch.root ${watchRoot.path} is OUTSIDE every configured root ` +
        `(${roots.join(", ")}). The daemon will not watch a folder it may not access.`,
    );
  }

  return Object.freeze({
    version: 1,
    roots: Object.freeze(roots),
    watch: Object.freeze({ root: watchRoot.path }),
    port: parsed.data.port,
    permTimeoutMs: parsed.data.permTimeoutMs,
    exec: Object.freeze({
      defaultTimeoutMs: parsed.data.exec.defaultTimeoutMs,
      maxOutputBytes: parsed.data.exec.maxOutputBytes,
    }),
    stateDir: path.resolve(path.dirname(configPath), parsed.data.stateDir),
  }) satisfies DaemonConfig;
};
