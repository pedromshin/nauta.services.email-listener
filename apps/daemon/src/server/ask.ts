/**
 * The WS half of the ONE permission model — the transport the broker's injected `AskFn` uses.
 *
 * Division of labour, deliberately: the BROKER owns the timeout clock (65-02) and the policy;
 * this file only carries the question to the clients and the answer back. Re-implementing the
 * timeout here would create the second authority the architecture explicitly forbids.
 *
 * R-03: `perm.request`'s payload has no id field, so the decision correlates to the perm.request
 * ENVELOPE's id — which means the prompt must be sent with an EXPLICIT envelope id equal to the
 * pending requestId. (`registry.broadcast` mints a fresh id per client and is therefore WRONG
 * here; we iterate and send with the shared id instead.)
 */
import { randomUUID } from "node:crypto";
import type { PermRequestPayload } from "@polytoken/daemon-protocol";

import type { AskFn } from "../permissions/broker.js";
import type { ClientRegistry } from "./clients.js";

export type Decision = { allow: boolean; remember: boolean };

export type PendingAsks = {
  /** First decision wins; unknown or duplicate requestIds are ignored (T-65-14). */
  resolve(requestId: string, decision: Decision): void;
  readonly size: number;
  create(): { requestId: string; promise: Promise<Decision | null> };
  /** Fail every outstanding ask closed — used on shutdown so nothing hangs. */
  cancelAll(): void;
};

/** T-65-15: an unbounded pending map is a memory-exhaustion vector on a localhost socket. */
export const MAX_PENDING_ASKS = 32;

export const createPendingAsks = (): PendingAsks => {
  const pending = new Map<string, (decision: Decision | null) => void>();

  return Object.freeze({
    resolve(requestId: string, decision: Decision): void {
      const settle = pending.get(requestId);
      // Unknown id, or an id already settled: ignore. A client cannot replay an old approval
      // into a new ask, nor flip an answered one.
      if (settle === undefined) return;
      pending.delete(requestId);
      settle(decision);
    },

    get size(): number {
      return pending.size;
    },

    create(): { requestId: string; promise: Promise<Decision | null> } {
      const requestId = randomUUID();
      const promise = new Promise<Decision | null>((resolve) => {
        pending.set(requestId, resolve);
      });
      return { requestId, promise };
    },

    cancelAll(): void {
      for (const [id, settle] of pending) {
        pending.delete(id);
        settle(null); // null = nobody answered = deny
      }
    },
  });
};

/**
 * Build the AskFn: prompt every connected client and await the first decision.
 *
 * With ZERO clients there is nobody who could ever answer, so this resolves null IMMEDIATELY
 * rather than holding the tool call for the full permTimeoutMs. Denying instantly is both the
 * safe answer and the honest one.
 */
export const createWsAsk = (registry: ClientRegistry, pending: PendingAsks): AskFn => {
  return async (request: PermRequestPayload): Promise<Decision | null> => {
    if (registry.size === 0) return null;

    if (pending.size >= MAX_PENDING_ASKS) {
      console.error(
        `[daemon:ask] refusing a new permission request: ${MAX_PENDING_ASKS} already outstanding.`,
      );
      return null;
    }

    const { requestId, promise } = pending.create();

    let delivered = 0;
    for (const client of registry.list()) {
      try {
        // R-03: the envelope id IS the requestId the decision will carry.
        client.send("perm.request", requestId, request);
        delivered += 1;
      } catch (error) {
        console.error(`[daemon:ask] could not prompt ${client.id}: ${(error as Error).message}`);
      }
    }

    // Every client failed to receive the prompt: same situation as having none.
    if (delivered === 0) {
      pending.resolve(requestId, { allow: false, remember: false });
      return null;
    }

    return promise;
  };
};
