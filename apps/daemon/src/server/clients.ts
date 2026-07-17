/**
 * The connected-client set, and the ONLY place `ws.send` is called (T-65-13).
 *
 * Every outbound payload is validated against `daemonToClient[type]` BEFORE transmission. An
 * outbound frame the daemon itself cannot validate is a DAEMON BUG, and it is surfaced here, at
 * its source — not delivered to Lane E's parser as garbage for them to debug.
 */
import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { daemonToClient, type MsgType } from "@polytoken/daemon-protocol";

export type Client = {
  readonly id: string;
  /** Validates against daemonToClient[type], then sends. Throws if the payload is invalid. */
  send(type: MsgType, id: string, payload: unknown): void;
};

export type ClientRegistry = {
  add(client: Client): void;
  remove(id: string): void;
  /** Mints a FRESH envelope id per client. */
  broadcast(type: MsgType, payload: unknown): void;
  readonly size: number;
  list(): readonly Client[];
};

const OPEN = 1;

export const createClient = (socket: WebSocket): Client => {
  const id = randomUUID();

  return Object.freeze({
    id,
    send(type: MsgType, envelopeId: string, payload: unknown): void {
      const schema = daemonToClient[type as keyof typeof daemonToClient];
      if (schema === undefined) {
        throw new Error(
          `[daemon:clients] "${type}" is not a legal daemon→client message type — refusing to send.`,
        );
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        // Loud, at the source. This is a bug in the daemon, not in the client.
        throw new Error(
          `[daemon:clients] refusing to send an invalid ${type} payload: ` +
            parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; "),
        );
      }

      if (socket.readyState !== OPEN) return;
      socket.send(JSON.stringify({ id: envelopeId, type, payload: parsed.data }));
    },
  });
};

export const createClientRegistry = (): ClientRegistry => {
  const clients = new Map<string, Client>();

  return Object.freeze({
    add(client: Client): void {
      clients.set(client.id, client);
    },

    remove(id: string): void {
      clients.delete(id);
    },

    broadcast(type: MsgType, payload: unknown): void {
      for (const client of clients.values()) {
        try {
          client.send(type, randomUUID(), payload);
        } catch (error) {
          // One dead/invalid socket must not stop the broadcast to the others.
          console.error(`[daemon:clients] broadcast to ${client.id} failed: ${(error as Error).message}`);
        }
      }
    },

    get size(): number {
      return clients.size;
    },

    list(): readonly Client[] {
      return Object.freeze([...clients.values()]);
    },
  });
};
