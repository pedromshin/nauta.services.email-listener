/**
 * The dispatch point. Every inbound frame crosses `parseClientFrame` (65-01) BEFORE any handler
 * sees it — no handler ever receives an unparsed payload (T-65-13).
 *
 * R-02: a frame that fails JSON/zod is answered with `tool.result { code: "protocol_error" }` and
 * the SOCKET STAYS OPEN. A typo in a dev client must not kill Lane E's session stream.
 * R-06: a legal-but-unregistered type answers `not_implemented`. That is the seam Lane E fills by
 * calling `register("session.start", ...)` — no router internals to touch.
 */
import { randomUUID } from "node:crypto";
import { parseClientFrame, type MsgType, type ToolErrorCode } from "@polytoken/daemon-protocol";

import type { DaemonConfig } from "../config.js";
import type { AuditLog } from "../permissions/audit.js";
import type { PermissionBroker } from "../permissions/broker.js";
import type { Client } from "./clients.js";

export type HandlerCtx = {
  client: Client;
  envelopeId: string;
  broker: PermissionBroker;
  config: DaemonConfig;
  audit: AuditLog;
};

export type Handler = (payload: unknown, ctx: HandlerCtx) => Promise<void>;

export type Router = {
  /** The seam: Lane E registers session.* handlers here. */
  register(type: MsgType, handler: Handler): void;
  dispatch(client: Client, raw: unknown): Promise<void>;
};

/** Reply with a structured error without inventing a new MsgType (R-02). */
export const sendToolError = (
  client: Client,
  requestId: string,
  code: ToolErrorCode,
  message: string,
): void => {
  try {
    client.send("tool.result", randomUUID(), {
      requestId: requestId.length > 0 ? requestId : "unknown",
      ok: false,
      output: { kind: "error", code, message },
    });
  } catch (error) {
    console.error(`[daemon:router] could not deliver error frame: ${(error as Error).message}`);
  }
};

export const createRouter = (base: Omit<HandlerCtx, "client" | "envelopeId">): Router => {
  const handlers = new Map<MsgType, Handler>();

  return Object.freeze({
    register(type: MsgType, handler: Handler): void {
      handlers.set(type, handler);
    },

    async dispatch(client: Client, raw: unknown): Promise<void> {
      const frame = parseClientFrame(raw);

      if (!frame.ok) {
        // Dropped + logged, and answered where an id is recoverable. Socket stays open.
        console.error(`[daemon:router] rejected a frame: ${frame.error}`);
        sendToolError(client, frame.id ?? "", "protocol_error", frame.error);
        return;
      }

      const handler = handlers.get(frame.type);
      if (handler === undefined) {
        // Legal type, no handler: honest `not_implemented` (R-06), not a lie and not a crash.
        sendToolError(
          client,
          frame.envelope.id,
          "not_implemented",
          `"${frame.type}" is not implemented by this daemon yet`,
        );
        return;
      }

      try {
        await handler(frame.payload, { ...base, client, envelopeId: frame.envelope.id });
      } catch (error) {
        // A throwing handler must not take the process down or silently drop the request.
        console.error(`[daemon:router] handler for ${frame.type} threw: ${(error as Error).message}`);
        sendToolError(client, frame.envelope.id, "io_failure", "the daemon failed to handle this request");
      }
    },
  });
};
