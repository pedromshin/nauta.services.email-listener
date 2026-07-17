/**
 * The CLI smoke script (DMON-06) — proves every capability END-TO-END over a REAL WebSocket.
 *
 *   npm run smoke -w @polytoken/daemon        (or: npx tsx scripts/smoke.ts)
 *
 * Design (65-CONTEXT.md §specifics): an in-process daemon on an EPHEMERAL port + a real `ws`
 * client dialing `ws://127.0.0.1:<port>` with the real header. Full network round-trip, no child
 * process fragility, no port collision. It builds its own throwaway root in the temp dir and
 * cleans up, so running it never touches your real files.
 *
 * The point is the NEGATIVE proofs. A smoke test that only shows happy paths would have passed
 * on every version of this daemon that was also catastrophically insecure:
 *   - a wrong token is REJECTED at the upgrade (the socket never opens)
 *   - an outside-roots path is DENIED, with NO permission prompt (it is not promptable)
 *   - a shell-injection string is INERT (it comes back as data; its side effect never happens)
 *   - a runaway process is KILLED at its timeout
 *   - the allowlist SURVIVES a daemon restart with no re-ask
 *
 * Exit code 0 = every check passed. Non-zero = a real failure, printed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { WebSocket } from "ws";

import { startDaemon, type DaemonHandle } from "../src/server/daemon.js";
import { canonicalizePath, type CanonicalPath } from "../src/permissions/paths.js";
import { builtinRegistry } from "../src/tools/handler.js";
import type { DaemonConfig } from "../src/config.js";
import type { Envelope } from "@polytoken/daemon-protocol";

const TOKEN = randomBytes(24).toString("hex");

let passed = 0;
let failed = 0;

const check = (name: string, condition: boolean, detail = ""): void => {
  if (condition) {
    passed += 1;
    console.log(`  [32mPASS[0m ${name}`);
  } else {
    failed += 1;
    console.log(`  [31mFAIL[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const section = (title: string): void => console.log(`\n[1m${title}[0m`);

const canon = (p: string): CanonicalPath => {
  const result = canonicalizePath(p);
  if (!result.ok) throw new Error(`could not canonicalize ${p}: ${result.reason}`);
  return result.path;
};

/** A client that auto-approves every permission request, so the smoke run is unattended. */
type SmokeClient = {
  socket: WebSocket;
  request(type: string, payload: unknown): Promise<Envelope>;
  prompts: number;
  close(): void;
};

const connect = async (port: number, token: string, autoApprove = true): Promise<SmokeClient> => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
    headers: { "x-daemon-token": token },
  });

  await new Promise<void>((resolve, reject) => {
    socket.on("open", () => resolve());
    socket.on("error", (error: Error) => reject(error));
  });

  const client: SmokeClient = {
    socket,
    prompts: 0,
    close: () => socket.terminate(),
    request(type: string, payload: unknown): Promise<Envelope> {
      const id = randomBytes(8).toString("hex");
      return new Promise<Envelope>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out awaiting a reply to ${type}`)), 20_000);

        const onMessage = (data: unknown): void => {
          const envelope = JSON.parse(String(data)) as Envelope;

          // Auto-approve prompts so an unattended run can exercise the allow paths.
          if (envelope.type === "perm.request") {
            client.prompts += 1;
            if (autoApprove) {
              socket.send(
                JSON.stringify({
                  id: randomBytes(8).toString("hex"),
                  type: "perm.decision",
                  payload: { requestId: envelope.id, allow: true, remember: true },
                }),
              );
            }
            return;
          }

          // R-01: a response echoes the request id. tool.result correlates via payload.requestId.
          const correlates =
            envelope.id === id ||
            (envelope.type === "tool.result" &&
              (envelope.payload as { requestId?: string }).requestId === id);
          if (!correlates) return;

          clearTimeout(timer);
          socket.off("message", onMessage);
          resolve(envelope);
        };

        socket.on("message", onMessage);
        socket.send(JSON.stringify({ id, type, payload }));
      });
    },
  };

  return client;
};

const main = async (): Promise<void> => {
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "daemon-smoke-")));
  const rootDir = path.join(work, "root");
  const outsideDir = path.join(work, "outside");
  fs.mkdirSync(rootDir, { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });
  fs.writeFileSync(path.join(outsideDir, "secret.txt"), "TOP SECRET — must never be readable");

  const config: DaemonConfig = Object.freeze({
    version: 1,
    roots: [canon(rootDir)],
    watch: { root: canon(rootDir) },
    port: 0, // ephemeral — no collision with a real daemon
    permTimeoutMs: 5_000,
    exec: { defaultTimeoutMs: 15_000, maxOutputBytes: 65_536 },
    stateDir: path.join(work, ".state"),
  }) as DaemonConfig;

  console.log(`[1mdaemon smoke[0m — root: ${rootDir}`);

  let handle: DaemonHandle = await startDaemon({ config, token: TOKEN });
  console.log(`daemon listening on ws://${handle.address}:${handle.port}\n`);

  try {
    // ── DMON-05: the door ────────────────────────────────────────────────────────────────────
    section("DMON-05  the door (auth + bind)");
    check("bound to 127.0.0.1, not 0.0.0.0", handle.address === "127.0.0.1", handle.address);

    let rejected = false;
    try {
      await connect(handle.port, "wrong-token-entirely-0000");
    } catch {
      rejected = true;
    }
    check("a WRONG token is REJECTED at the upgrade (socket never opens)", rejected);

    let noTokenRejected = false;
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${handle.port}`);
      await new Promise<void>((resolve, reject) => {
        socket.on("open", () => resolve());
        socket.on("error", (e: Error) => reject(e));
      });
    } catch {
      noTokenRejected = true;
    }
    check("a MISSING token is REJECTED at the upgrade", noTokenRejected);

    const client = await connect(handle.port, TOKEN);
    check("the CORRECT token connects", client.socket.readyState === WebSocket.OPEN);

    // ── the protocol seam ────────────────────────────────────────────────────────────────────
    section("DMON-05  protocol + Lane E's seam");
    const list = await client.request("session.list", {});
    check(
      "session.list answers { sessions: [] } honestly",
      JSON.stringify(list.payload) === JSON.stringify({ sessions: [] }),
      JSON.stringify(list.payload),
    );

    const notImpl = await client.request("session.start", { cwd: rootDir });
    check(
      "session.start answers not_implemented (Lane E's seam, not a lie)",
      (notImpl.payload as { output: { code: string } }).output.code === "not_implemented",
    );

    // Defense in depth, and a REAL Phase 68 constraint: the frozen protocol's `tool` field is a
    // CLOSED discriminated union, so an unknown id is refused by the PROTOCOL (protocol_error)
    // and never reaches the registry's not_implemented path at all. Two layers, both closed.
    // Consequence for D2: an `source: "external"` capability cannot be invoked over the frozen
    // wire until toolRequestSchema's union is widened (an additive protocol change). Flagged in
    // the phase SUMMARY — the registry is ready for it; the wire is not, by design.
    const junk = await client.request("tool.request", { tool: "nope", args: {} });
    const junkPayload = junk.payload as { ok: boolean; output: { code: string } };
    check(
      "an unknown capability id is refused by the protocol union (defense in depth)",
      junkPayload.ok === false && junkPayload.output.code === "protocol_error",
      junkPayload.output.code,
    );

    const stillAlive = await client.request("session.list", {});
    check(
      "...and the socket STAYS OPEN after the bad frame",
      JSON.stringify(stillAlive.payload) === JSON.stringify({ sessions: [] }),
    );

    // ── DMON-02: the permission model — THE NEGATIVE PROOFS ──────────────────────────────────
    section("DMON-02  the permission model (the negative proofs)");
    const promptsBefore = client.prompts;
    const outside = await client.request("tool.request", {
      tool: "fs.read",
      args: { path: path.join(outsideDir, "secret.txt") },
    });
    const outsidePayload = outside.payload as { ok: boolean; output: { code: string } };
    check("an OUTSIDE-ROOTS read is DENIED", outsidePayload.ok === false, JSON.stringify(outsidePayload));
    check("...with code outside_roots", outsidePayload.output.code === "outside_roots");
    check(
      "...and NO permission prompt was shown (the hard boundary is not promptable)",
      client.prompts === promptsBefore,
      `prompts went ${promptsBefore} -> ${client.prompts}`,
    );
    check(
      "...and the secret never appeared on the wire",
      !JSON.stringify(outsidePayload).includes("TOP SECRET"),
    );

    const traversal = await client.request("tool.request", {
      tool: "fs.read",
      args: { path: path.join(rootDir, "..", "outside", "secret.txt") },
    });
    check(
      "a ..\\ TRAVERSAL escape is DENIED",
      (traversal.payload as { output: { code: string } }).output.code === "outside_roots",
    );

    // ── DMON-03: the ToolExecutor ────────────────────────────────────────────────────────────
    section("DMON-03  the ToolExecutor (fs)");
    const target = path.join(rootDir, "smoke.txt");
    const write = await client.request("tool.request", {
      tool: "fs.write",
      args: { path: target, content: "written by the smoke run" },
    });
    check("fs.write succeeds inside a root", (write.payload as { ok: boolean }).ok === true);
    check("...and the file really exists on disk", fs.existsSync(target));

    const read = await client.request("tool.request", { tool: "fs.read", args: { path: target } });
    check(
      "fs.read returns the content it wrote",
      (read.payload as { output: { content: string } }).output.content === "written by the smoke run",
    );

    const listDir = await client.request("tool.request", { tool: "fs.list", args: { path: rootDir } });
    check(
      "fs.list sees the file",
      (listDir.payload as { output: { entries: Array<{ name: string }> } }).output.entries.some(
        (e) => e.name === "smoke.txt",
      ),
    );

    // ── the injection proof ──────────────────────────────────────────────────────────────────
    section("DMON-03  terminal.exec (injection inert, timeout kills)");
    const canary = path.join(rootDir, "PWNED.txt");
    const injection = `benign & echo pwned > "${canary}"`;
    const exec = await client.request("tool.request", {
      tool: "terminal.exec",
      args: {
        cwd: rootDir,
        command: process.execPath,
        args: ["-e", "console.log(process.argv[1])", injection],
      },
    });
    const execOut = exec.payload as { ok: boolean; output: { stdout: string } };
    check("terminal.exec runs a real process", execOut.ok === true);
    check(
      "the INJECTION string came back as literal DATA (one argv entry)",
      execOut.output.stdout.includes("echo pwned"),
      execOut.output.stdout.trim(),
    );
    check(
      "...and its SIDE EFFECT never happened (no shell exists to interpret it)",
      !fs.existsSync(canary),
    );

    const runaway = await client.request("tool.request", {
      tool: "terminal.exec",
      args: {
        cwd: rootDir,
        command: process.execPath,
        args: ["-e", "setInterval(() => {}, 1000)"],
        timeoutMs: 1_500,
      },
    });
    check(
      "a RUNAWAY process is KILLED at its timeout",
      (runaway.payload as { output: { timedOut: boolean } }).output.timedOut === true,
    );

    // ── git ──────────────────────────────────────────────────────────────────────────────────
    section("DMON-03  git");
    const gitInit = await client.request("tool.request", {
      tool: "terminal.exec",
      args: { cwd: rootDir, command: "git", args: ["init"] },
    });
    check("git init (via terminal.exec) succeeds", (gitInit.payload as { ok: boolean }).ok === true);

    const status = await client.request("tool.request", {
      tool: "git",
      args: { cwd: rootDir, subcommand: "status" },
    });
    const statusOut = status.payload as { ok: boolean; output: { stdout: string } };
    check("git status runs against a REAL repo", statusOut.ok === true);
    check("...and reports the untracked file", statusOut.output.stdout.includes("smoke.txt"));

    const gitEscape = await client.request("tool.request", {
      tool: "git",
      args: { cwd: rootDir, subcommand: "add", paths: ["..\\outside\\secret.txt"] },
    });
    check(
      "git add CANNOT stage a path outside the roots",
      (gitEscape.payload as { output: { code: string } }).output.code === "outside_roots",
    );

    // ── DMON-04: the watcher ─────────────────────────────────────────────────────────────────
    section("DMON-04  the watched folder");
    // Wait for OUR file specifically. `git init` above populated .git/, so the first watch event
    // to arrive is not necessarily the one this check causes — an ordering assumption that would
    // make this check pass or fail for reasons unrelated to the watcher.
    const watched = new Promise<Envelope | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 8_000);
      client.socket.on("message", (data: unknown) => {
        const envelope = JSON.parse(String(data)) as Envelope;
        if (envelope.type !== "fs.watch.event") return;
        if ((envelope.payload as { path: string }).path !== "watched-file.txt") return;
        clearTimeout(timer);
        resolve(envelope);
      });
    });

    await new Promise((r) => setTimeout(r, 600)); // let chokidar settle
    fs.writeFileSync(path.join(rootDir, "watched-file.txt"), "hello watcher");
    const event = await watched;

    check("touching a file in the watched folder emits fs.watch.event", event !== null);
    if (event !== null) {
      const payload = event.payload as { root: string; path: string; kind: string };
      check("...with a root-relative FORWARD-slash path", !payload.path.includes("\\"), payload.path);
      check("...naming the file", payload.path === "watched-file.txt", payload.path);
      check("...with kind 'add'", payload.kind === "add", payload.kind);
      check("...and the absolute configured root (R-08)", payload.root === config.watch.root);
    }

    // ── DMON-02: the allowlist survives a restart ────────────────────────────────────────────
    section("DMON-02  the allowlist survives a daemon RESTART");
    const allowlistPath = path.join(config.stateDir, "allowlist.json");
    check("the allowlist was persisted to disk", fs.existsSync(allowlistPath));

    const rulesOnDisk = JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as { rules: unknown[] };
    check("...and holds the remembered grants", rulesOnDisk.rules.length > 0, `${rulesOnDisk.rules.length} rules`);

    client.close();
    await handle.close();

    handle = await startDaemon({ config, token: TOKEN });
    // autoApprove: FALSE — if the daemon asks again, the request will hang and fail the check.
    const afterRestart = await connect(handle.port, TOKEN, false);
    const rereadTimeout = await Promise.race([
      afterRestart.request("tool.request", { tool: "fs.read", args: { path: target } }),
      new Promise<null>((r) => setTimeout(() => r(null), 6_000)),
    ]);

    check("a REMEMBERED grant is honored after restart", rereadTimeout !== null);
    check(
      "...with NO re-ask (silence would have hung this request)",
      afterRestart.prompts === 0,
      `${afterRestart.prompts} prompts`,
    );
    if (rereadTimeout !== null) {
      check(
        "...and returns the right content",
        (rereadTimeout.payload as { output: { content: string } }).output.content ===
          "written by the smoke run",
      );
    }
    afterRestart.close();

    // ── the registry (D2 seam) ───────────────────────────────────────────────────────────────
    section("D2/INV-2  the capability registry");
    const manifest = builtinRegistry.list();
    check("every builtin capability is describable", manifest.length === 5, `${manifest.length} capabilities`);
    check(
      "every entry declares id/describe/risk/cost/source/trust",
      manifest.every(
        (e) => e.id && e.describe && e.risk && e.cost && e.source && e.trust,
      ),
    );
    console.log("\n  the registry, as an LLM/genui would read it:");
    for (const entry of manifest) {
      console.log(`    ${entry.id.padEnd(14)} risk=${entry.risk.padEnd(5)} cost=${entry.cost.padEnd(9)} ${entry.describe.slice(0, 58)}...`);
    }
  } finally {
    await handle.close();
    fs.rmSync(work, { recursive: true, force: true });
  }

  console.log(`\n[1m${passed} passed, ${failed} failed[0m`);
  if (failed > 0) process.exit(1);
};

main().catch((error: unknown) => {
  console.error(`\n[31msmoke run crashed:[0m ${(error as Error).message}`);
  process.exit(1);
});
