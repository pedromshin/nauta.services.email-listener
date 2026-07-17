/**
 * Safe child-process execution — the single spawn point for terminal.exec AND git.
 *
 * The non-negotiables, all structural:
 * - **`shell: false`, ALWAYS.** There is no shell, so there is no shell-injection path. A string
 *   like `foo & calc.exe` is one literal argv entry, inert. This is why the protocol types
 *   terminal args as `string[]` and never accepts a command line.
 * - **Mandatory timeout.** A runaway child is killed, tree-first (`taskkill /T /F` on Windows,
 *   best-effort — see the deferred note in the phase summary).
 * - **Bounded capture.** Output is capped at `maxOutputBytes`; a child that prints forever cannot
 *   exhaust the daemon's memory.
 * - **Token scrubbed from the child env.** A spawned process must never inherit DAEMON_TOKEN — it
 *   would hand the gate to anything the user runs.
 */
import { spawn } from "node:child_process";

export type SpawnResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly durationMs: number;
  readonly truncated: boolean;
};

/** Env vars a child must never inherit. */
const SECRET_ENV_KEYS = ["DAEMON_TOKEN"] as const;

/** Strip the daemon's secrets from the environment handed to a child process. */
export const scrubEnv = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const copy: NodeJS.ProcessEnv = { ...env };
  for (const key of SECRET_ENV_KEYS) delete copy[key];
  return copy;
};

/** Best-effort tree kill. Windows has no process groups; taskkill /T is the closest thing. */
const killTree = (pid: number | undefined): void => {
  if (pid === undefined) return;
  if (process.platform === "win32") {
    try {
      // Detached + ignored stdio: this is a fire-and-forget cleanup, never awaited.
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
        stdio: "ignore",
      }).unref();
    } catch {
      // Fall through to the direct kill below.
    }
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Already dead — the normal case after taskkill.
  }
};

export const safeSpawn = async (opts: {
  command: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
}): Promise<SpawnResult> => {
  const started = Date.now();

  return new Promise<SpawnResult>((resolve) => {
    const child = spawn(opts.command, [...opts.args], {
      cwd: opts.cwd,
      // shell:false is THE mitigation. Never make this configurable.
      shell: false,
      windowsHide: true,
      env: scrubEnv(process.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let settled = false;
    let timedOut = false;

    const capture = (chunk: Buffer, onto: "out" | "err"): void => {
      const current = onto === "out" ? stdout : stderr;
      const remaining = opts.maxOutputBytes - (stdout.length + stderr.length);
      if (remaining <= 0) {
        truncated = true;
        return;
      }
      const text = chunk.toString("utf8");
      const slice = text.length > remaining ? text.slice(0, remaining) : text;
      if (slice.length < text.length) truncated = true;
      if (onto === "out") stdout = current + slice;
      else stderr = current + slice;
    };

    child.stdout?.on("data", (c: Buffer) => capture(c, "out"));
    child.stderr?.on("data", (c: Buffer) => capture(c, "err"));

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, opts.timeoutMs);

    const settle = (exitCode: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        durationMs: Date.now() - started,
        truncated,
      });
    };

    child.on("error", (error: Error) => {
      stderr += `${error.message}`;
      settle(null);
    });

    // R-12 rationale: a signal-killed child reports code null; callers coerce where the schema
    // demands a number.
    child.on("close", (code) => settle(code));
  });
};
