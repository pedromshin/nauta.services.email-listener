/**
 * The hard boundary (T-65-05).
 *
 * This daemon executes fs/terminal/git on the user's real PC. Every path string arriving in a
 * tool.request is HOSTILE until it has passed through here. The rule that makes this sound:
 * canonicalize (resolve + realpath, so junctions and traversal cannot hide), then compare with
 * `path.relative` — NEVER `startsWith`, which reports `C:\roots\abc` as inside `C:\roots\a`.
 *
 * Design notes:
 * - Hostile SHAPES (NUL / ADS / UNC / device names) are rejected BEFORE touching the filesystem:
 *   a syscall on `\\?\C:\...` or `CON` is itself a hazard.
 * - Absent leaves still get realpath'd via their deepest EXISTING ancestor. Skipping realpath
 *   because the file does not exist yet is how a write through a junction ancestor escapes.
 * - Result-shaped for input-shaped failures; throws only on unexpected syscall errors.
 */
import fs from "node:fs";
import path from "node:path";

/** An absolute, realpath-resolved, backslash-normalized path. Only this type may cross the boundary. */
export type CanonicalPath = string & { readonly __brand: "CanonicalPath" };

export type CanonicalizeResult =
  | { readonly ok: true; readonly path: CanonicalPath }
  | { readonly ok: false; readonly reason: string };

/** Win32 reserved device names: opening one has side effects that are not file access at all. */
const RESERVED_DEVICE_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

const deny = (reason: string): CanonicalizeResult => ({ ok: false, reason });

/**
 * Reject hostile shapes before any syscall. Order matters: NUL first (it truncates C strings),
 * then the path forms Node would happily hand to the OS.
 */
const rejectHostileShape = (raw: string): string | null => {
  if (raw.length === 0) return "path is empty";
  if (raw.includes("\0")) return "path contains a NUL byte";

  const normalizedSlashes = raw.replace(/\//g, "\\");

  // UNC (\\server\share) and extended-length/device (\\?\, \\.\) forms — out of scope tonight.
  if (normalizedSlashes.startsWith("\\\\")) {
    return "UNC and device paths (\\\\server\\share, \\\\?\\C:\\...) are not permitted";
  }

  // ADS: `file.txt:hidden` hides content behind a stream. The ONLY legal colon is the drive's,
  // at index 1 of an absolute path.
  const colonIndex = normalizedSlashes.indexOf(":", 2);
  if (colonIndex !== -1) return "path contains an alternate data stream marker (colon)";
  if (normalizedSlashes.length >= 2 && normalizedSlashes[1] === ":") {
    if (!/^[a-zA-Z]:\\/.test(normalizedSlashes)) return "malformed drive-letter path";
  }

  if (!path.win32.isAbsolute(normalizedSlashes)) return "path is not absolute";

  for (const segment of normalizedSlashes.split("\\")) {
    if (segment.length === 0) continue;
    const base = (segment.split(".")[0] ?? "").toLowerCase();
    if (RESERVED_DEVICE_NAMES.has(base)) return `path contains the reserved device name "${segment}"`;
  }

  return null;
};

/**
 * Realpath the deepest EXISTING ancestor, then re-join the non-existing tail. This is what makes
 * a write to `<root>\jct\brand\new.txt` (junction ancestor, absent leaf) resolve to its real
 * target instead of silently trusting the literal path.
 */
const realpathDeepestExisting = (absolute: string): string => {
  const segments: string[] = [];
  let current = absolute;

  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return segments.length === 0 ? real : path.win32.join(real, ...segments.reverse());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;

      const parent = path.win32.dirname(current);
      // Reached the drive root and it still does not exist: nothing to resolve against.
      if (parent === current) return absolute;
      segments.push(path.win32.basename(current));
      current = parent;
    }
  }
};

/**
 * Turn a hostile string into a CanonicalPath, or refuse with a reason.
 * Refusal is the common case and is not an error condition.
 */
export const canonicalizePath = (raw: string): CanonicalizeResult => {
  if (typeof raw !== "string") return deny("path is not a string");

  const shapeProblem = rejectHostileShape(raw);
  if (shapeProblem !== null) return deny(shapeProblem);

  const absolute = path.win32.resolve(raw.replace(/\//g, "\\"));

  // path.resolve collapses `..` lexically; realpath then resolves junctions/symlinks. Both are
  // needed — neither alone is sufficient.
  let resolved: string;
  try {
    resolved = realpathDeepestExisting(absolute);
  } catch (error) {
    return deny(`path could not be resolved: ${(error as Error).message}`);
  }

  // realpath can hand back a \\?\ form for long paths; that shape is out of scope.
  if (resolved.startsWith("\\\\")) return deny("resolved path is a UNC or device path");

  const normalized = path.win32.normalize(resolved).replace(/[\\/]+$/, "") || resolved;
  return { ok: true, path: normalized as CanonicalPath };
};

/**
 * Is `target` inside ANY root? The comparison is `path.relative`-based and case-folded (win32 is
 * case-insensitive): a relative result that is empty (target IS the root) or that neither starts
 * with `..` nor is absolute (target is under the root) means inside.
 *
 * An empty roots array denies everything: no roots configured = no universe.
 */
export const isInsideRoots = (
  target: CanonicalPath,
  roots: readonly CanonicalPath[],
): boolean => {
  const foldedTarget = target.toLowerCase();

  return roots.some((root) => {
    const relative = path.win32.relative(root.toLowerCase(), foldedTarget);
    if (relative === "") return true;
    if (path.win32.isAbsolute(relative)) return false;
    // `..` alone, or any `..\` prefix, means the target climbed out.
    return relative !== ".." && !relative.startsWith(`..\\`);
  });
};
