/**
 * The builtin capabilities: fs (read/write/list), terminal (exec), git.
 *
 * Every one is a `CapabilityDescriptor` — self-describing, resolved by `id`, with `risk` as DATA
 * (INV-4). None of them consults the permission store: the broker decides BEFORE `execute` is
 * ever called (65-02's design — executors receive only what they need to run).
 *
 * The ids are the frozen wire tool names, which is what lets the allowlist key on registry ids
 * (INV-2) while the protocol stays frozen for Lane E.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { canonicalizePath } from "../permissions/paths.js";
import { defineCapability, type CapabilityDescriptor } from "./registry.js";
import { safeSpawn } from "./spawn.js";

/** Resolve a path for execution. The broker already proved it is inside roots. */
const mustCanonicalize = (raw: string): string => {
  const result = canonicalizePath(raw);
  if (!result.ok) throw new Error(`invalid path: ${result.reason}`);
  return result.path;
};

// ── fs.read ────────────────────────────────────────────────────────────────────────────────────

const fsReadInput = z.object({ path: z.string().min(1) }).strict();

export const fsReadCapability = defineCapability({
  id: "fs.read",
  input: fsReadInput,
  output: z
    .object({
      kind: z.literal("fs.read"),
      content: z.string(),
      bytes: z.number().int().min(0),
      truncated: z.boolean(),
    })
    .strict(),
  risk: "read",
  cost: "cheap",
  describe:
    "Read a UTF-8 text file from inside a configured root. Content is capped at the configured " +
    "output limit; binary files are not supported.",
  source: "builtin",
  trust: "first-party",
  scope: (input) => ({ scope: input.path, pathsToCheck: [input.path] }),
  execute: async (input, ctx) => {
    const target = mustCanonicalize(input.path);
    const buffer = await fsp.readFile(target);
    const truncated = buffer.byteLength > ctx.maxOutputBytes;
    const slice = truncated ? buffer.subarray(0, ctx.maxOutputBytes) : buffer;
    return {
      kind: "fs.read" as const,
      content: slice.toString("utf8"),
      bytes: buffer.byteLength,
      truncated,
    };
  },
});

// ── fs.write ───────────────────────────────────────────────────────────────────────────────────

const fsWriteInput = z.object({ path: z.string().min(1), content: z.string() }).strict();

export const fsWriteCapability = defineCapability({
  id: "fs.write",
  input: fsWriteInput,
  output: z
    .object({ kind: z.literal("fs.write"), path: z.string(), bytes: z.number().int().min(0) })
    .strict(),
  risk: "write",
  cost: "cheap",
  describe:
    "Write UTF-8 text to a file inside a configured root, creating parent directories as needed. " +
    "Overwrites the file if it exists.",
  source: "builtin",
  trust: "first-party",
  // The parent dir is checked too: creating dirs outside roots must not be reachable via a path
  // whose leaf is inside but whose ancestor is not.
  scope: (input) => ({ scope: input.path, pathsToCheck: [input.path, path.win32.dirname(input.path)] }),
  execute: async (input) => {
    const target = mustCanonicalize(input.path);
    await fsp.mkdir(path.win32.dirname(target), { recursive: true });
    await fsp.writeFile(target, input.content, "utf8");
    return {
      kind: "fs.write" as const,
      path: target,
      bytes: Buffer.byteLength(input.content, "utf8"),
    };
  },
});

// ── fs.list ────────────────────────────────────────────────────────────────────────────────────

const fsListInput = z.object({ path: z.string().min(1) }).strict();

export const fsListCapability = defineCapability({
  id: "fs.list",
  input: fsListInput,
  output: z
    .object({
      kind: z.literal("fs.list"),
      entries: z.array(
        z
          .object({
            name: z.string(),
            kind: z.enum(["file", "dir", "other"]),
            size: z.number().int().min(0).nullable(),
          })
          .strict(),
      ),
    })
    .strict(),
  risk: "read",
  cost: "cheap",
  describe: "List the immediate entries of a directory inside a configured root.",
  source: "builtin",
  trust: "first-party",
  scope: (input) => ({ scope: input.path, pathsToCheck: [input.path] }),
  execute: async (input) => {
    const target = mustCanonicalize(input.path);
    const dirents = await fsp.readdir(target, { withFileTypes: true });

    const entries = await Promise.all(
      dirents.map(async (dirent) => {
        const kind = dirent.isFile() ? "file" : dirent.isDirectory() ? "dir" : "other";
        let size: number | null = null;
        if (kind === "file") {
          try {
            size = (await fsp.stat(path.win32.join(target, dirent.name))).size;
          } catch {
            size = null; // vanished between readdir and stat — report the entry, not a crash
          }
        }
        return { name: dirent.name, kind, size };
      }),
    );

    return { kind: "fs.list" as const, entries };
  },
});

// ── terminal.exec ──────────────────────────────────────────────────────────────────────────────

const terminalInput = z
  .object({
    cwd: z.string().min(1),
    command: z.string().min(1),
    args: z.array(z.string()).max(64).default([]),
    timeoutMs: z.number().int().min(1).max(600_000).optional(),
  })
  .strict();

/**
 * R-13: roots bound DATA and working directories, not the executable. `node.exe` legitimately
 * lives in `C:\Program Files\nodejs` — outside every root — so the executable is permitted by
 * NAME (the allowlist's terminal scope is a case-folded basename), while the CWD must be inside
 * roots like any other data path.
 *
 * Granting a SHELL binary (`cmd`, `powershell`) by name re-opens injection inside that grant.
 * That is the user's explicit, remembered decision to make, surfaced at `risk: "exec"` — the
 * daemon does not silently decide it for them.
 */
export const terminalExecCapability = defineCapability({
  id: "terminal.exec",
  input: terminalInput,
  output: z
    .object({
      kind: z.literal("terminal.exec"),
      exitCode: z.number().int().nullable(),
      stdout: z.string(),
      stderr: z.string(),
      timedOut: z.boolean(),
      durationMs: z.number().int().min(0),
      truncated: z.boolean(),
    })
    .strict(),
  risk: "exec",
  cost: "moderate",
  describe:
    "Run an executable with an argument ARRAY (never a shell command line) in a directory inside " +
    "a configured root. No shell is involved, so shell metacharacters are inert. Always bounded " +
    "by a timeout and an output cap.",
  source: "builtin",
  trust: "first-party",
  // Scope is the EXECUTABLE NAME (R-13); only the cwd is boundary-checked.
  scope: (input) => ({ scope: input.command, pathsToCheck: [input.cwd] }),
  execute: async (input, ctx) => {
    const cwd = mustCanonicalize(input.cwd);
    const result = await safeSpawn({
      command: input.command,
      // `.default([])` makes args optional on the INPUT side of the schema, so TS sees it as
      // possibly-undefined here even though zod fills it. Defaulting again is free and honest.
      args: input.args ?? [],
      cwd,
      timeoutMs: input.timeoutMs ?? ctx.defaultTimeoutMs,
      maxOutputBytes: ctx.maxOutputBytes,
    });
    return { kind: "terminal.exec" as const, ...result };
  },
});

// ── git ────────────────────────────────────────────────────────────────────────────────────────

const gitInput = z
  .object({
    cwd: z.string().min(1),
    subcommand: z.enum(["status", "log", "diff", "branch", "add", "commit"]),
    paths: z.array(z.string()).max(256).optional(),
    message: z.string().max(10_000).optional(),
    maxCount: z.number().int().min(1).max(500).optional(),
  })
  .strict();

type GitInput = z.infer<typeof gitInput>;

/** Read-only subcommands cost `read`; the mutating pair costs `write` (R-04). */
const GIT_WRITE_SUBCOMMANDS = new Set(["add", "commit"]);

/**
 * Build git's argv. `--` before pathspecs, always: without it a path named `--foo` is parsed as
 * an option. Every arg is a separate array entry — there is no command line to inject into.
 */
export const buildGitArgs = (input: GitInput): string[] => {
  const args: string[] = [input.subcommand];

  switch (input.subcommand) {
    case "status":
      args.push("--porcelain=v1");
      break;
    case "log":
      args.push("--oneline", `--max-count=${input.maxCount ?? 20}`);
      break;
    case "diff":
      // No pager, no colour: this output is parsed, not read by a human in a TTY.
      args.push("--no-color");
      break;
    case "branch":
      args.push("--list");
      break;
    case "commit":
      if (input.message === undefined || input.message.length === 0) {
        throw new Error("git commit requires a message");
      }
      // -m takes the message as its own argv entry: a message containing `&& rm -rf` is literal.
      args.push("-m", input.message);
      break;
    case "add":
      if (input.paths === undefined || input.paths.length === 0) {
        // Never `git add -A`/`.` — the lane contract forbids blanket staging, and a daemon that
        // can stage everything can commit a secret by accident.
        throw new Error("git add requires an explicit list of paths");
      }
      break;
  }

  if (input.paths !== undefined && input.paths.length > 0 && input.subcommand !== "commit") {
    args.push("--", ...input.paths);
  }

  return args;
};

export const gitCapability = defineCapability({
  id: "git",
  input: gitInput,
  output: z
    .object({
      kind: z.literal("git"),
      exitCode: z.number().int(),
      stdout: z.string(),
      stderr: z.string(),
    })
    .strict(),
  // The union's risk is the ceiling: the handler narrows per subcommand (see handler.ts).
  risk: "write",
  cost: "cheap",
  describe:
    "Run a safe git subcommand (status/log/diff/branch/add/commit) in a repository inside a " +
    "configured root. Pathspecs are passed after `--`. Push is deliberately not available.",
  source: "builtin",
  trust: "first-party",
  scope: (input) => ({
    scope: input.cwd,
    pathsToCheck: [
      input.cwd,
      // Pathspecs are relative to the repo; check them as real targets so `git add ..\..\x`
      // cannot stage a file outside the roots.
      ...(input.paths ?? []).map((p) =>
        path.win32.isAbsolute(p) ? p : path.win32.join(input.cwd, p),
      ),
    ],
  }),
  execute: async (input, ctx) => {
    const cwd = mustCanonicalize(input.cwd);
    const result = await safeSpawn({
      command: "git",
      args: buildGitArgs(input),
      cwd,
      timeoutMs: ctx.defaultTimeoutMs,
      maxOutputBytes: ctx.maxOutputBytes,
    });
    return {
      kind: "git" as const,
      // R-12 rationale: coerce a signal-killed null rather than widening the schema.
      exitCode: result.exitCode ?? -1,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  },
});

/** INV-4: risk is data. git's risk depends on the subcommand, so it is derived from the INPUT. */
export const gitRiskFor = (subcommand: GitInput["subcommand"]): "read" | "write" =>
  GIT_WRITE_SUBCOMMANDS.has(subcommand) ? "write" : "read";

export const BUILTIN_CAPABILITIES: readonly CapabilityDescriptor<never, never>[] = [
  fsReadCapability,
  fsWriteCapability,
  fsListCapability,
  terminalExecCapability,
  gitCapability,
] as unknown as readonly CapabilityDescriptor<never, never>[];
