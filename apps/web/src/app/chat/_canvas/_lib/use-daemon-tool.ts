/**
 * use-daemon-tool — the bridge that lets a canvas panel DRIVE the local daemon (v2.0).
 *
 * A panel calls `call("browser.navigate", { url })` or `call("fs.read", { path })`; the hook opens
 * (and shares) ONE client-side WebSocket to the local daemon (ws://127.0.0.1 — never our servers),
 * sends a `tool.request`, and resolves the matching `tool.result` by requestId. When the daemon's
 * permission broker asks (`perm.request` for a write/exec capability), the hook surfaces it as
 * `pendingPermission` so the panel can render the INV-4 confirm card and answer with `perm.decision`.
 *
 * Honesty about auth: a browser WebSocket cannot send the `x-daemon-token` header, so the token
 * rides `?token=` (the daemon now accepts it at the upgrade gate). With no token configured, status
 * is `no-daemon` and every `call` rejects with a clear reason — the panels show their teaching state.
 *
 * The connection is a module singleton: many panels, one socket. It is intentionally NOT torn down
 * on unmount (a browser panel that reconnects on every render would be unusable); it closes when the
 * tab does.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { PermRequestPayload } from "@polytoken/daemon-protocol";

import {
  buildDaemonUrl,
  decodeDaemonFrame,
  newEnvelopeId,
  readDaemonConfig,
} from "../../../sessions/_lib/daemon-client";

export type DaemonStatus = "no-daemon" | "connecting" | "ready" | "error";

export type ToolCallResult =
  | { readonly ok: true; readonly output: Record<string, unknown> }
  | { readonly ok: false; readonly error: string; readonly code?: string };

export type PendingPermission = {
  /** The perm.request envelope id — perm.decision.requestId correlates to THIS (R-03). */
  readonly id: string;
  readonly tool: string;
  readonly risk: PermRequestPayload["risk"];
};

type Pending = { resolve: (r: ToolCallResult) => void; timer: ReturnType<typeof setTimeout> };

const CALL_TIMEOUT_MS = 30_000;

/** The one shared connection. Created lazily on the first call from any panel. */
class DaemonConnection {
  private ws: WebSocket | null = null;
  private readonly pending = new Map<string, Pending>();
  status: DaemonStatus = "no-daemon";
  permissions: PendingPermission[] = [];
  private readonly listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    for (const fn of this.listeners) fn();
  }
  private set(status: DaemonStatus): void {
    this.status = status;
    this.emit();
  }

  private ensureSocket(): WebSocket | null {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return this.ws;
    }
    const config = readDaemonConfig();
    if (!config.token) {
      this.set("no-daemon");
      return null;
    }
    this.set("connecting");
    const ws = new WebSocket(buildDaemonUrl(config));
    this.ws = ws;
    ws.onopen = () => this.set("ready");
    ws.onerror = () => this.set("error");
    ws.onclose = () => {
      this.ws = null;
      if (this.status !== "no-daemon") this.set("error");
      // Fail every in-flight call so a panel never hangs on a dropped socket.
      for (const [, p] of this.pending) {
        clearTimeout(p.timer);
        p.resolve({ ok: false, error: "the daemon connection closed" });
      }
      this.pending.clear();
    };
    ws.onmessage = (event) => this.onFrame(String(event.data));
    return ws;
  }

  private onFrame(raw: string): void {
    const frame = decodeDaemonFrame(raw);
    if (!frame.ok) return; // R-02: a bad frame is dropped, socket stays open
    if (frame.type === "tool.result") {
      const payload = frame.payload as { requestId: string; ok: boolean; output: Record<string, unknown> };
      const p = this.pending.get(payload.requestId);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(payload.requestId);
      if (payload.ok) p.resolve({ ok: true, output: payload.output });
      else {
        const out = payload.output as { code?: string; message?: string };
        p.resolve({ ok: false, error: out.message ?? "the daemon refused", code: out.code });
      }
      return;
    }
    if (frame.type === "perm.request") {
      const payload = frame.payload as PermRequestPayload;
      // Correlate by the perm.request ENVELOPE id (R-03), not a payload field.
      this.permissions = [...this.permissions, { id: frame.envelope.id, tool: payload.tool, risk: payload.risk }];
      this.emit();
    }
  }

  call(tool: string, args: unknown): Promise<ToolCallResult> {
    const ws = this.ensureSocket();
    if (!ws) return Promise.resolve({ ok: false, error: "no daemon is configured (set a token in /sessions)" });
    return new Promise<ToolCallResult>((resolve) => {
      const id = newEnvelopeId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: `the daemon did not answer within ${CALL_TIMEOUT_MS / 1000}s` });
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      const send = () => ws.send(JSON.stringify({ id, type: "tool.request", payload: { tool, args } }));
      if (ws.readyState === WebSocket.OPEN) send();
      else ws.addEventListener("open", send, { once: true });
    });
  }

  resolvePermission(id: string, allow: boolean, remember = false): void {
    this.permissions = this.permissions.filter((p) => p.id !== id);
    this.emit();
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ id: newEnvelopeId(), type: "perm.decision", payload: { requestId: id, allow, remember } }));
    }
  }
}

let connection: DaemonConnection | null = null;
const getConnection = (): DaemonConnection => {
  connection ??= new DaemonConnection();
  return connection;
};

export type UseDaemonTool = {
  readonly status: DaemonStatus;
  readonly pendingPermissions: readonly PendingPermission[];
  call(tool: string, args: unknown): Promise<ToolCallResult>;
  resolvePermission(id: string, allow: boolean, remember?: boolean): void;
};

export function useDaemonTool(): UseDaemonTool {
  const conn = getConnection();
  const [, force] = useState(0);

  useEffect(() => conn.subscribe(() => force((n) => n + 1)), [conn]);

  const call = useCallback((tool: string, args: unknown) => conn.call(tool, args), [conn]);
  const resolvePermission = useCallback(
    (id: string, allow: boolean, remember = false) => conn.resolvePermission(id, allow, remember),
    [conn],
  );

  return { status: conn.status, pendingPermissions: conn.permissions, call, resolvePermission };
}

/** Test seam: reset the module singleton between tests. */
export function __resetDaemonConnectionForTests(): void {
  connection = null;
}
